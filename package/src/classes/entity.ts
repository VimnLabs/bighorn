import { GENERIC_MESSAGES } from "@src/constants";
import { Rest }             from "@src/core/rest";
import { log }              from "@src/logger";

/**
 * Base abstract class representing a generic entity returned from the API.
 *
 * This class associates a raw data structure with the REST client and provides
 * a default `fetch` method that can be overridden in subclasses to re-fetch or
 * update the entity. It also includes internal logging and a name tag for
 * debugging.
 *
 * @template Raw - The structure of the raw API data associated with the
 *   entity.
 */
export abstract class Entity<Raw> {
  /**
   * Identifiable name of the entity, used for logging/debugging.
   * Format: `Entity(Name)`
   */
  protected readonly name: `Entity(${ string })`
  
  /**
   * Constructs a new entity instance.
   *
   * @param rest - REST client instance used to make API requests.
   * @param raw - Raw data received from the API, representing the entity
   *   state.
   * @param name - Human-readable or semantic name to help identify this entity
   *   type during logging.
   */
  protected constructor(
    public readonly rest: Rest,
    public readonly raw: Raw,
    name: string
  ) {
    this.name = `Entity(${ name })`
  }
  
  /**
   * Placeholder method to fetch or update the entity from the API.
   *
   * Subclasses should override this method to implement actual fetching logic.
   * Logs a warning by default indicating the method is not implemented.
   *
   * @returns `undefined` by default.
   */
  public fetch(): unknown {
    log.warn( this.format_name( "fetch" ), GENERIC_MESSAGES.NOT_IMPLEMENTED )
    return undefined;
  }

  protected format_name(): `Entity(${ string })`

  protected format_name<Prop extends string>(prop?: Prop): `Entity(${ string })::${ Prop }`
  
  protected format_name<Prop extends string>(prop?: Prop): `Entity(${ string })` | `Entity(${ string })::${ Prop }` {
    if ( !prop ) return this.name;
    return `${ this.name }::${ prop }`
  }
}
