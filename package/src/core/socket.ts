import {
  fill_replacer,
  GATEWAY,
  KEYWORDS,
  SOCKET_MESSAGES
}              from "@src/constants";
import { log } from "@src/logger";
import {
  type GatewayDispatchEvents,
  type GatewayDispatchPayload,
  GatewayIntentBits,
  GatewayOpcodes,
  GatewayPresenceUpdateData,
  type GatewayReceivePayload,
  type GatewaySendPayload
}              from "discord-api-types/v10";

const SOCKET_HEADER = "WebSocket";

/**
 * Configuration options for the Socket class.
 */
export interface SocketSettings {
  token: string;
  intents: GatewayIntentBits | number;
  maxRetries?: number;
  sessionStore?: {
    load: () => Promise<{ sessionId: string; seq: number } | null>;
    save: (data: { sessionId: string; seq: number }) => void;
    clear: () => void;
  };
  debug?: boolean;
  warns?: boolean
}

/**
 * Defines the exact handler type for a specific GatewayDispatchEvents.
 */
export type EventHandler<E extends GatewayDispatchEvents> = (
  payload: Extract<GatewayDispatchPayload, { t: E }>["d"]
) => unknown;

/**
 * Socket handles Discord Gateway connection and events.
 */
export class Socket {
  protected started: boolean;
  private _lastPing = 0;
  private _lastACK = 0;
  private _heartbeat: NodeJS.Timeout | null = null;
  private _sessionId: string | null = null;
  private _lastSequence: number | null = null;
  private _reconnecting = false;
  private _retries = 0;
  // Map that stores each event with its correctly typed handler
  private events: Map<GatewayDispatchEvents, EventHandler<GatewayDispatchEvents>> = new Map();
  
  constructor(private readonly settings: SocketSettings) {
    this.started = false;
  }
  
  private _ws: WebSocket | null = null;
  
  get ws(): WebSocket {
    if ( !this._ws ) {
      throw log.fail( SOCKET_HEADER, SOCKET_MESSAGES.NO_SOCKET ).error();
    }
    return this._ws;
  }
  
  /**
   * Returns the current ping latency in milliseconds.
   */
  public ping(): number {
    const delta = this._lastACK - this._lastPing;
    return delta >= 0 ? delta : 0;
  }
  
  /**
   * Properly closes the WebSocket connection and cleans up resources.
   */
  public async destroy(): Promise<boolean> {
    try {
      if ( this._heartbeat ) {
        clearInterval( this._heartbeat );
        this._heartbeat = null;
      }
      
      if ( this._ws ) {
        const ws = this._ws;
        const closing = new Promise<void>( (res) => {
          ws.onclose = () => res();
        } );
        
        if ( ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING ) {
          if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.SOCKET_CLOSING );
          ws.close( 1000, SOCKET_MESSAGES.DESTROYED );
        }
        
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        
        this._ws = null;
        
        await closing;
        if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.DESTROYED );
      }
      
      return true;
    } catch ( err ) {
      log.fail( SOCKET_HEADER, String( err ) );
      return false;
    }
  }
  
  /**
   * Adds or replaces a listener for a specific GatewayDispatch event,
   * with exact typing for the payload.
   */
  public listen<E extends GatewayDispatchEvents>(event: E, handler: EventHandler<E>) {
    if ( this.events.has( event ) ) {
      if ( this.settings.warns ) log.warn( SOCKET_HEADER, SOCKET_MESSAGES.LISTENER_REPLACED.replace( ...fill_replacer( {
        [KEYWORDS.Event] : event
      } ) ) );
    }
    this.events.set( event, handler as unknown as EventHandler<GatewayDispatchEvents> );
  }
  
  /**
   * Attempts to reconnect the WebSocket connection with optional session
   * clearing. Implements exponential backoff and max retry limits.
   */
  public async reconnect(clear = false): Promise<boolean> {
    if ( this._reconnecting ) return false;
    this._reconnecting = true;
    
    await this.destroy();
    
    if ( clear ) {
      this._sessionId = null;
      this._lastSequence = null;
      this.settings.sessionStore?.clear();
      if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.SESSION_CLEARED );
    }
    
    const retries = this._retries++;
    const maxRetries = this.settings.maxRetries ?? 5;
    
    if ( retries >= maxRetries ) {
      log.fail( SOCKET_HEADER, SOCKET_MESSAGES.MAX_RETRIES_EXCEEDED );
      this.settings.sessionStore?.clear();
      this._reconnecting = false;
      return false;
    }
    
    const backoff = Math.min( 2 ** retries * 1000, 30000 );
    
    return new Promise( (resolve, reject) => {
      setTimeout( async () => {
        try {
          await this.start();
          this._retries = 0;
          this._reconnecting = false;
          resolve( true );
        } catch ( e ) {
          log.fail( SOCKET_HEADER, String( e ) );
          this._reconnecting = false;
          reject( false );
        }
      }, backoff );
    } );
  }
  
  /**
   * Sends a presence update payload to the Discord Gateway.
   */
  public presence(data: GatewayPresenceUpdateData) {
    this.ws.send(
      JSON.stringify( {
        op : GatewayOpcodes.PresenceUpdate,
        d : data
      } )
    );
  }
  
  /**
   * Starts the WebSocket connection and sets up event handlers.
   * Loads session info if available to attempt resume.
   */
  public async start(): Promise<void> {
    this.started = true;
    this._ws = new WebSocket( GATEWAY );
    
    const resumeData = await this.settings.sessionStore?.load();
    if ( resumeData ) {
      this._sessionId = resumeData.sessionId;
      this._lastSequence = resumeData.seq;
    }
    
    return new Promise( (resolve, reject) => {
      this._ws!.onopen = () => {
        this._lastACK = Date.now();
        if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.CONNECTED );
        resolve();
      };
      
      this._ws!.onclose = ({ reason }) => {
        if ( this.settings.warns ) log.warn( SOCKET_HEADER, SOCKET_MESSAGES.CLOSED.replace( ...fill_replacer( {
          [KEYWORDS.Reason] : reason
        } ) ) )
      };
      
      //@ts-expect-error
      this._ws!.onerror = (err: ErrorEvent) => {
        reject( log.fail( SOCKET_HEADER, err.message ) );
      };
      
      this._ws!.onmessage = this._handleMessage.bind( this );
    } );
  }
  
  /**
   * Internal method to handle incoming WebSocket messages.
   * Parses payload, handles opcodes, and dispatches events.
   */
  private async _handleMessage(event: MessageEvent) {
    let payload: GatewayReceivePayload;
    
    try {
      payload = JSON.parse( event.data.toString() );
    } catch ( err ) {
      log.fail( SOCKET_HEADER, SOCKET_MESSAGES.JSON_INVALID.replace( ...fill_replacer( {
        [KEYWORDS.Data] : String( event.data )
      } ) ) );
      return;
    }
    
    const { op, t, d, s } = payload;
    
    // Update last sequence number and save session info if available
    if ( s ) {
      this._lastSequence = s;
      if ( this._sessionId ) {
        this.settings.sessionStore?.save( {
          sessionId : this._sessionId,
          seq : s
        } );
      }
    }
    
    switch ( op ) {
      case GatewayOpcodes.Hello:
        this._lastPing = Date.now();
        this._heartbeat = setInterval( () => {
          this._lastPing = Date.now();
          this._ws!.send(
            JSON.stringify( {
              op : GatewayOpcodes.Heartbeat,
              d : this._lastSequence
            } )
          );
          if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.PING_SENT );
        }, d.heartbeat_interval );
        
        this._ws!.send(
          JSON.stringify( {
            op : GatewayOpcodes.Identify,
            d : {
              token : this.settings.token,
              intents : this.settings.intents,
              properties : {
                os : "linux",
                browser : "bighorn",
                device : "bighorn"
              }
            }
          } as GatewaySendPayload )
        );
        break;
      
      case GatewayOpcodes.HeartbeatAck:
        this._lastACK = Date.now();
        if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.ACK );
        break;
      
      case GatewayOpcodes.Reconnect:
        if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.RECONNECT );
        await this.reconnect();
        break;
      
      case GatewayOpcodes.InvalidSession:
        if ( this.settings.warns ) log.warn( SOCKET_HEADER, SOCKET_MESSAGES.INVALID_SESSION );
        if ( d && this._sessionId && this._lastSequence !== null ) {
          if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.RESUME );
          this._ws!.send(
            JSON.stringify( {
              op : GatewayOpcodes.Resume,
              d : {
                token : this.settings.token,
                session_id : this._sessionId,
                seq : this._lastSequence
              }
            } )
          );
        } else {
          if ( this.settings.debug ) log.echo( SOCKET_HEADER, SOCKET_MESSAGES.RECONNECT );
          await this.reconnect( true );
        }
        break;
      
      case GatewayOpcodes.Dispatch:
        if ( t === "READY" && typeof d === "object" && d.session_id ) {
          this._sessionId = d.session_id;
          this.settings.sessionStore?.save( {
            sessionId : d.session_id,
            seq : this._lastSequence ?? 0
          } );
        }
        if ( t ) {
          const handler = this.events.get( t ) as EventHandler<typeof t> | undefined;
          if ( handler ) {
            try {
              handler( d );
            } catch ( err ) {
              log.fail( SOCKET_HEADER, `Error in event handler ${ t }: ${ String( err ) }` );
            }
          }
        }
        break;
    }
  }
}
