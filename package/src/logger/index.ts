import { writeFile }                   from 'node:fs/promises';
import { join }                        from 'node:path';
import { Level, paint, style, Styles } from 'src/logger/styler';

/**
 * Represents a class that constructs an Error-like object.
 * @template T The type of error to return
 */
export type ErrorClass<T extends globalThis.Error = globalThis.Error> =
  new (message: string) => T;

export class Log {
  public readonly cache: string[];
  
  constructor(
    /** This is used to identify from which logger a log comes from, for example: “EventEmitter”. */
    public readonly emmiter: string,
    /** Function used to format the date and time of your log. */
    public readonly formatter: (date: Date) => string = (date) =>
      `${ date.toLocaleDateString() } ${ date.toLocaleTimeString() }`
  ) {
    this.cache = [];
  }
  
  /** Leave a simple note on your console! */
  public note(kind: string, ...messages: string[]) {
    console.log(
      '',
      this.format( {
        level : Level.Note,
        styles : [ Styles.BgBlue ],
        messages,
        kind
      } )
    );
  }
  
  /** Leave a warn on your console! */
  public warn(kind: string, ...messages: string[]) {
    console.warn(
      '',
      this.format( {
        level : Level.Warn,
        styles : [ Styles.BgYellow ],
        messages,
        kind
      } )
    );
  }
  
  /** Leave an echo (debug) message on your console! */
  public echo(kind: string, ...messages: string[]) {
    console.debug(
      '',
      this.format( {
        level : Level.Echo,
        styles : [ Styles.BgMagenta ],
        messages,
        kind
      } )
    );
  }
  
  /**
   * Leave a fail message on your console!.
   *
   * Tip: You can use `fail({...}).error()` to transform the fail to an
   * error. The kind will be
   * used as the error type. Ex: If kind is `Type` so the error instance will
   * be `TypeError`
   */
  public fail(kind: string, ...messages: string[]) {
    console.error(
      paint( Styles.Reset ),
      this.format( {
        level : Level.Fail,
        styles : [ Styles.BgRed ],
        messages : messages.map( (text) => style( {
          text,
          styles : [ Styles.Red ]
        } ) ),
        kind
      } )
    );
    
    return {
      /**
       * Converts a list of messages into an instance of the given error class.
       *
       * @template T A class extending the built-in Error.
       * @param errorCtor A class constructor for the error to instantiate.
       *   Defaults to Error.
       * @returns An instance of the given error class with the joined message.
       */
      error<T extends globalThis.Error = globalThis.Error>(
        errorCtor: ErrorClass<T> = globalThis.Error as unknown as ErrorClass<T>
      ): T {
        return new errorCtor( messages.join( "\n" ) );
      }
    };
  }
  
  public save(path = `/${ Date.now() }.log`) {
    return new Promise( (res, rej) => {
      try {
        writeFile( join( process.cwd(), path ), this.cache.join( '\n' ) ).then( res );
      } catch ( e ) {
        rej( String( e ) );
      }
    } );
  }
  
  private format({
                   level,
                   styles,
                   kind,
                   messages,
                   color = Styles.White
                 }: {
    level: Level;
    styles: Styles[];
    kind: string;
    messages: string[];
    color?: Styles;
  }) {
    const log = `[ ${ this.emmiter } |> [ ${ level } ] |> ${ kind } ] |> ${ this.formatter( new Date() ) }\n${ messages
      .map( (line) => line.replace( /(\n?)(.+)/g, '$1 | $2' ) )
      .join( '\n' ) }\n`;
    // biome-ignore lint/suspicious/noControlCharactersInRegex:
    this.cache.push( ` ${ log.replace( /\u001b\[\d{1,3}(?:;\d{1,3})*m/g, '' ) }` );
    return `${ log.replace(
      new RegExp( `(\\[\\s*)(${level})(\\s*\\])`, 'g' ),
      `${ style( { text : ' $2 ', styles : [ ...styles, color ] } ) }`
    ) }`;
  }
}

export const log = new Log( "BigHorn" );