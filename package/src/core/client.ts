import { Application }                           from "@src/classes/entities/application";
import { Method, Rest }                          from "@src/core/rest";
import { EventHandler, Socket, SocketSettings }  from "@src/core/socket";
import { log }                                   from "@src/logger";
import { APIApplication, GatewayDispatchEvents } from "discord-api-types/v10";

/**
 * Configuration object used to initialize a {@link Client} instance.
 * Extends {@link SocketSettings} to include WebSocket options.
 */
export type ClientSettings = SocketSettings


/**
 * Represents the root client that manages Discord connectivity,
 * including WebSocket communication, REST API interactions, and application
 * state.
 *
 * This is the primary entry point for interacting with Discord's Gateway and
 * REST API.
 */
export class Client {
  /**
   * Internal timestamp (nanoseconds) when the client was initialized.
   * Used to calculate uptime via {@link Client.uptime}.
   */
  protected _start_time = Bun.nanoseconds();
  
  /**
   * Creates a new {@link Client} instance with the given configuration.
   *
   * @param settings - The {@link ClientSettings} used to initialize the
   *   connection.
   */
  constructor(public settings: ClientSettings) {
    this._socket = new Socket( {
      intents : settings.intents,
      token : `Bot ${ settings.token }`,
      maxRetries : settings.maxRetries,
      sessionStore : settings.sessionStore
    } );
    
    this._rest = new Rest( settings.token );
  }
  
  /**
   * The underlying WebSocket handler used for connecting to the Discord
   * Gateway.
   */
  protected _socket: Socket;
  
  /**
   * Exposes the WebSocket connection used by this client.
   */
  public get socket(): Socket {
    return this._socket;
  }
  
  /**
   * Internal REST handler used to perform HTTP requests to Discord's API.
   */
  protected _rest: Rest;
  
  /**
   * Exposes the REST client used by this client.
   */
  public get rest(): Rest {
    return this._rest;
  }
  
  /**
   * Returns the total uptime (in nanoseconds) since the client was constructed.
   *
   * If the client was destroyed, the uptime will be `0`.
   */
  public get uptime(): number {
    const time = Bun.nanoseconds() - this._start_time;
    if ( time < 0 ) return 0;
    return time;
  }
  
  /**
   * Initiates the WebSocket connection to Discord's Gateway.
   *
   * @returns A promise that resolves when the connection is fully established.
   * @throws If the connection fails, a formatted error is thrown.
   */
  public async connect(): Promise<void> {
    return await this._socket.start();
  }
  
  /**
   * Gracefully shuts down the client and disconnects from Discord.
   *
   * This will invalidate uptime and close the Gateway session.
   *
   * @returns A promise that resolves once the client has been cleaned up.
   */
  public async destroy(): Promise<boolean> {
    this._start_time = 0;
    return await this._socket.destroy();
  }
  
  /**
   * Adds a typed event listener to the Discord Gateway socket.
   *
   * The listener will be called whenever the specified
   * {@link GatewayDispatchEvents} event is received.
   *
   * @typeParam E - The name of the gateway dispatch event to listen for.
   * @param event - The gateway event name.
   * @param handler - A strongly typed event handler function.
   * @returns A disposable listener function for removing the handler.
   */
  public listen<E extends GatewayDispatchEvents>(event: E, handler: EventHandler<E>) {
    return this._socket.listen( event, handler );
  }
  
  /**
   * Retrieves information about the currently authenticated user (the bot
   * account).
   *
   * @returns The bot user object.
   * @throws If the request fails, a formatted error is thrown.
   */
  public async me() {
    try {
      return await this._rest.me();
    } catch ( err ) {
      throw log.fail( this.format_name( "me" ), String( err ) ).error();
    }
  }
  
  /**
   * Fetches the current application metadata from the Discord API.
   *
   * This is often used for checking OAuth2 details, flags, or
   * application-level emojis.
   *
   * @returns An {@link Application} instance representing the current bot's
   *   application.
   * @throws If the request fails, a formatted error is thrown.
   */
  public async app(): Promise<Application> {
    try {
      const API = await this.rest.request<APIApplication>( {
        method : Method.GET,
        route : "currentApplication"
      } );
      
      return new Application( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "app" ), String( err ) ).error();
    }
  }
  
  /**
   * Sends a ping to the Discord Gateway to measure latency.
   *
   * @returns The latency in milliseconds.
   */
  public ping(): number {
    return this._socket.ping();
  }
  
  /**
   * Utility method for formatting the origin of logs and error messages.
   *
   * @typeParam Prop - The property name being accessed.
   * @param prop - The name of the method or field being formatted.
   * @returns A formatted string in the form `Client::${prop}`.
   */
  protected format_name<Prop extends string>(prop: Prop): `Client::${ Prop }` {
    return `${ this.constructor.name as "Client" }::${ prop }`;
  }
}
