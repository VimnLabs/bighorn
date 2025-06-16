import { User }            from "@src/classes/entities/user";
import { ENDPOINT }        from "@src/constants";
import { Dictionary }      from "@src/dictionary";
import { APIUser, Routes } from "discord-api-types/v10";

/**
 * Represents a queued job to be executed in the rate-limit bucket.
 */
type RequestJob = {
  fn: () => Promise<void>;
};

/**
 * Represents rate limit metadata and request queue for a specific method+route.
 */
type BucketInfo = {
  resetAt: number;
  remaining: number;
  queue: RequestJob[];
  isRunning: boolean;
};

/**
 * Supported HTTP methods for Discord REST requests.
 */
export enum Method {
  POST = "POST",
  GET = "GET",
  PATCH = "PATCH",
  DELETE = "DELETE",
  PUT = "PUT"
}

/**
 * Represents a file to be uploaded via multipart/form-data.
 */
export interface Attachment {
  file: ArrayBuffer;
  name: string;
}

/**
 * Handles communication with the Discord REST API.
 *
 * This class manages rate limits via internal buckets, queues requests,
 * and ensures compliance with Discord's 429 rate-limiting mechanisms.
 */
export class Rest {
  /**
   * Public cache dictionary (read/write by external components only if needed).
   */
  public readonly cache = new Dictionary<string, unknown>();
  /** Internal rate-limit bucket management. */
  protected readonly buckets = new Dictionary<string, BucketInfo>();
  
  constructor(public readonly token: string) {}
  
  public async me(): Promise<User> {
    const ME_KEY = "@me";
    let API = this.cache.get( ME_KEY ) as APIUser | undefined;
    if ( !API ) {
      API = await this.request<APIUser>( {
        method : Method.GET,
        route : "user",
        args : [ "@me" ]
      } )
      
      this.cache.set( ME_KEY, API )
    }
    
    return new User( this, API );
  }
  
  /**
   * Sends a typed REST request to the Discord API.
   *
   * @template Return - Expected return type.
   * @template Body - JSON body type.
   * @template Route - Route key in Routes.
   * @template Params - Parameter tuple for the route.
   */
  public async request<
    Return,
    Body = unknown,
    Route extends keyof typeof Routes = keyof typeof Routes,
    Params extends Parameters<(typeof Routes)[Route]> = Parameters<(typeof Routes)[Route]>
  >({
      method,
      route : _route,
      args,
      body,
      attachments,
      reason,
      query
    }: {
    method: Method;
    route: Route;
    args?: Params;
    body?: Body;
    attachments?: Attachment[];
    reason?: string;
    query?: Record<string, string | boolean>
  }): Promise<Return> {
    const route = (Routes[_route] as (...args: any[]) => string)
    let url =
      `${ ENDPOINT }${ args ? route( ...args ) : route() }`;
    
    if ( query && Object.keys( query ).length > 0 ) {
      url += `?${ Object.entries( query ).map( ([ k, v ]) =>
        `${ encodeURIComponent( k ) }=${ encodeURIComponent( v ) }`
      ).join( "&" ) }`
    }
    
    const headers: HeadersInit = {
      Authorization : `Bot ${ this.token }`
    };
    
    if ( reason ) headers["X-Audit-Log-Reason"] = encodeURIComponent( reason );
    
    let finalBody: BodyInit | undefined;
    
    if ( attachments?.length ) {
      const form = new FormData();
      // Append files
      attachments.forEach( (a, i) =>
        form.append( `files[${ i }]`, new Blob( [ a.file ] ), a.name )
      );
      // Append payload JSON
      if ( body ) {
        form.append( "payload_json", JSON.stringify( body ) );
      }
      finalBody = form;
      // FormData sets its own content-type
    } else {
      headers["Content-Type"] = "application/json";
      finalBody = body ? JSON.stringify( body ) : undefined;
    }
    
    return new Promise( (resolve, reject) => {
      this.queueRequest( method, _route, async () => {
        const res = await fetch( url, {
          method,
          headers,
          body : finalBody
        } );
        
        const remaining = parseInt( res.headers.get( "X-RateLimit-Remaining" ) ?? "1" );
        const reset = parseFloat( res.headers.get( "X-RateLimit-Reset" ) ?? "0" );
        
        const key = this.getBucketKey( method, _route );
        const bucket = this.buckets.get( key );
        if ( bucket ) {
          bucket.remaining = remaining;
          bucket.resetAt = reset * 1000;
        }
        
        if ( !res.ok ) {
          const err = await res.json().catch( () => ({}) );
          reject( { status : res.status, body : err } );
        } else {
          const data = await res.json().catch( () => ({}) );
          resolve( data );
        }
      } );
    } );
  }
  
  private getBucketKey(method: string, route: string): string {
    return `${ method.toUpperCase() } ${ route }`;
  }
  
  private async queueRequest(method: string, route: string, exec: () => Promise<void>) {
    const key = this.getBucketKey( method, route );
    const bucket = this.buckets.get( key ) ?? {
      resetAt : 0,
      remaining : 1,
      queue : [],
      isRunning : false
    };
    
    bucket.queue.push( { fn : exec } );
    this.buckets.set( key, bucket );
    
    if ( !bucket.isRunning ) this.runBucket( key );
  }
  
  private runBucket(key: string): void {
    const bucket = this.buckets.get( key );
    if ( !bucket ) return;
    
    if ( bucket.remaining <= 0 && Date.now() < bucket.resetAt ) {
      const delay = bucket.resetAt - Date.now();
      setTimeout( () => this.runBucket( key ), delay );
      return;
    }
    
    const job = bucket.queue.shift();
    if ( !job ) {
      bucket.isRunning = false;
      return;
    }
    
    bucket.isRunning = true;
    bucket.remaining--;
    
    job.fn().finally( () => {
      this.runBucket( key );
    } );
  }
}
