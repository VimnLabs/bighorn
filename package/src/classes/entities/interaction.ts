import {
  APIApplicationCommandAutocompleteResponse,
  APIApplicationCommandOptionChoice,
  APIChannel,
  APIGuild,
  APIInteraction,
  APIInteractionResponseCallbackData,
  APIMessage,
  APIModalInteractionResponse,
  APIModalInteractionResponseCallbackData,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  MessageType,
  RESTPostAPIInteractionCallbackJSONBody,
  RESTPostAPIInteractionCallbackWithResponseResult,
  Snowflake
} from "discord-api-types/v10";
import {
  ENTITY_MESSAGES,
  format_simple_entity,
  KEYWORDS,
  replace
} from "../../constants";
import {
  Attachment,
  Method,
  Rest
} from "../../core/rest";
import {
  Dictionary
} from "../../dictionary";
import {
  log
} from "../../logger";
import {
  Entity
} from "../entity";
import {
  Channel
} from "./channel";
import {
  Guild
} from "./guild";
import {
  Member
} from "./member";
import {
  Message
} from "./message";
import {
  User
} from "./user";

/**
 * Represents a Discord interaction entity, such as slash commands,
 * buttons, modals, etc. This class provides utility methods to handle
 * replies, deferrals, and follow-ups using Discord's API.
 *
 * @template Type - The type of the interaction (e.g. Ping, Command, etc.)
 * @template Raw - The raw interaction payload received from Discord
 */
export class Interaction<Type extends InteractionType = InteractionType, Raw extends APIInteraction & {
  type: Type
} = APIInteraction & { type: Type }> extends Entity<Raw> {
  /** Internal counter for remaining follow-up messages (max 5) */
  private _remaining_followup: number = 5;
  
  /** Dictionary of follow-up messages sent using this interaction */
  private _followup_messages: Dictionary<Snowflake, Message> = new Dictionary( undefined, this._remaining_followup, "followup_messages" );
  
  /**
   * Constructs a new Interaction instance.
   *
   * @param rest - The REST client instance used for requests
   * @param raw - The raw API interaction object
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /** Indicates whether a reply or defer has been completed */
  private _completed: boolean = false;
  
  /** Whether the interaction has been completed (replied or deferred) */
  get completed(): boolean {
    return this._completed;
  }
  
  /** Indicates whether the interaction has been deferred */
  private _deferred: boolean = false;
  
  /** Whether the interaction has been deferred */
  get deferred(): boolean {
    return this._deferred;
  }
  
  /** Access to follow-up metadata including remaining count and messages */
  get followup() {
    return {
      remaining : this._remaining_followup,
      messages : this._followup_messages
    };
  }
  
  /**
   * Fetches the guild associated with this interaction, if available.
   *
   * @returns A Guild instance or null if unavailable
   */
  public async guild(): Promise<Guild | null> {
    try {
      if ( !this.raw.guild ) return null;
      const API = await this.rest.request<APIGuild>( {
        method : Method.GET,
        route : "guild",
        args : [ this.raw.guild.id ]
      } );
      return new Guild( this.rest, API );
    } catch ( err ) {
      log.warn( this.format_name( "channel" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Fetches the channel where the interaction occurred.
   *
   * @returns A Channel instance or null if unavailable
   */
  public async channel(): Promise<Channel | null> {
    try {
      if ( !this.raw.channel ) return null;
      return new Channel( this.rest, this.raw.channel as APIChannel );
    } catch ( err ) {
      log.warn( this.format_name( "channel" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Fetches the member that triggered the interaction.
   *
   * @returns A Member instance or null if unavailable
   */
  public async member(): Promise<Member | null> {
    try {
      const guild = await this.guild();
      if ( !this.raw.member || !guild ) return null;
      return new Member( this.rest, this.raw.member, guild.raw );
    } catch ( err ) {
      log.warn( this.format_name( "member" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Fetches the user who triggered the interaction.
   *
   * @returns A User instance or null if unavailable
   */
  public async user(): Promise<User | null> {
    try {
      const member = await this.member();
      if ( member ) return member.user;
      if ( this.raw.user ) return new User( this.rest, this.raw.user );
      return null;
    } catch ( err ) {
      log.warn( this.format_name( "user" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Fetches the original message of the interaction, if already replied or
   * deferred.
   *
   * @returns The original Message instance or null
   */
  public async original(): Promise<Message<MessageType, APIMessage> | null> {
    if ( !this._deferred || !this._completed ) return null;
    try {
      const API = await this.rest.request<APIMessage>( {
        method : Method.GET,
        route : "webhookMessage",
        args : [ this.raw.application_id, this.raw.token, "@original" ]
      } );
      return new Message( this.rest, API );
    } catch ( err ) {
      log.warn( this.format_name( "original" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Defers the interaction response, marking it as loading.
   *
   * @param flags - Optional message flags
   * @returns Whether the deffer was successful
   */
  public async defer(flags?: MessageFlags): Promise<boolean> {
    try {
      if ( this._deferred ) {
        log.warn( this.format_name( "defer" ), ENTITY_MESSAGES.ALREADY_DEFERRED );
        return true;
      }
      await this.rest.request<void, RESTPostAPIInteractionCallbackJSONBody>( {
        method : Method.POST,
        route : "interactionCallback",
        args : [ this.raw.id, this.raw.token ],
        body : {
          type : InteractionResponseType.DeferredChannelMessageWithSource,
          data : {
            flags : MessageFlags.Loading | (flags ?? 0)
          }
        }
      } );
      this._deferred = true;
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "defer" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Defers the update of an interaction response to signal the client that a
   * response is coming, particularly useful for component interactions such as
   * button clicks.
   *
   * If the interaction has already been deferred, a warning is logged and the
   * function returns `true`. This method sends a `DeferredMessageUpdate`
   * response to the Discord API.
   *
   * @returns {Promise<boolean>} `true` if the defer was successful or already
   *   deferred, otherwise `false`.
   */
  public async deferUpdate(): Promise<boolean> {
    try {
      if ( this._deferred ) {
        log.warn( this.format_name( "defer" ), ENTITY_MESSAGES.ALREADY_DEFERRED );
        return true;
      }
      
      await this.rest.request<void, RESTPostAPIInteractionCallbackJSONBody>( {
        method : Method.POST,
        route : "interactionCallback",
        args : [ this.raw.id, this.raw.token ],
        body : {
          type : InteractionResponseType.DeferredMessageUpdate
        }
      } );
      
      this._deferred = true;
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "deferUpdate" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Marks the interaction as completed to prevent further edits or responses.
   *
   * This flag is typically used internally to track the state of an
   * interaction lifecycle.
   *
   * @returns {boolean} Always returns `true` once the internal flag is set.
   */
  public markCompleted(): boolean {
    this._completed = true;
    return true;
  }
  
  /**
   * Sends a reply or follow-up to the interaction. Handles
   * defer/edit/follow-up logic.
   *
   * @param data - The response payload
   * @param attachments - Optional attachments to include
   * @returns The sent Message instance
   */
  public async reply(data: APIInteractionResponseCallbackData, attachments?: Attachment[]): Promise<Message> {
    if ( this._remaining_followup <= 0 )
      throw log.fail( this.format_name( "reply" ), ENTITY_MESSAGES.FOLLOW_UP_REACHED ).error();
    
    try {
      // First reply
      if ( !this._deferred ) {
        const API = await this.rest.request<RESTPostAPIInteractionCallbackWithResponseResult, RESTPostAPIInteractionCallbackJSONBody>( {
          method : Method.POST,
          route : "interactionCallback",
          args : [ this.raw.id, this.raw.token ],
          body : {
            type : InteractionResponseType.ChannelMessageWithSource,
            data
          },
          attachments,
          query : {
            with_response : true
          }
        } );
        
        this._deferred = true;
        this._completed = true;
        return new Message( this.rest, API.resource?.message as APIMessage );
      }
      
      // Edit first reply
      if ( !this._completed ) {
        const API = await this.rest.request<APIMessage>( {
          method : Method.PATCH,
          route : "webhookMessage",
          args : [ this.raw.application_id, this.raw.token, "@original" ],
          body : data,
          attachments
        } );
        
        this._completed = true;
        return new Message( this.rest, API );
      }
      
      // Follow-up
      --this._remaining_followup;
      log.warn( this.format_name( "reply" ), replace( ENTITY_MESSAGES.FOLLOW_UP_REMAINING, {
        [KEYWORDS.Remaining] : this._remaining_followup
      } ) );
      
      const API = await this.rest.request<APIMessage>( {
        method : Method.POST,
        route : "webhook",
        args : [ this.raw.application_id, this.raw.token ],
        body : data,
        attachments
      } ), MESSAGE = new Message( this.rest, API );
      
      this._followup_messages.set( MESSAGE.raw.id, MESSAGE );
      return MESSAGE;
    } catch ( err ) {
      throw log.fail( this.format_name( "reply" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits the original reply message or sends one if not already completed.
   *
   * @param data - Response payload to update
   * @param attachments - Optional attachments to include
   * @returns The edited Message instance
   */
  public async edit(data: APIInteractionResponseCallbackData, attachments?: Attachment[]) {
    if ( !this._completed ) {
      return await this.reply( data, attachments );
    }
    try {
      const API = await this.rest.request<APIMessage>( {
        method : Method.PATCH,
        route : "webhookMessage",
        args : [ this.raw.application_id, this.raw.token, "@original" ],
        body : data,
        attachments
      } );
      return new Message( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "user" ), String( err ) ).error();
    }
  }
  
  /**
   * Deletes the original message sent by the interaction.
   *
   * @param reason - Optional audit log reason
   * @returns Whether the deletion was successful
   */
  public async destroy(reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.DELETE,
        route : "webhookMessage",
        args : [ this.raw.application_id, this.raw.token, "@original" ],
        reason
      } );
      return true;
    } catch ( err ) {
      throw log.fail( this.format_name( "destroy" ), String( err ) ).error();
    }
  }
  
  /**
   * Responds to an autocomplete interaction by sending a list of choices back
   * to Discord. This method should only be used within the context of an
   * application command interaction.
   *
   * @param choices - An array of choices to present in the autocomplete UI.
   * @returns A promise resolving to `true` if the response was successfully
   *   sent, otherwise `false`.
   *
   * @remarks
   * If the interaction is not of type `ApplicationCommand`, the method logs a
   *   warning and returns `false`. Any request error during the REST call is
   *   also logged and causes the method to return `false`.
   *
   * @example
   * ```ts
   * ctx.autocomplete([
   *   { name: "Option A", value: "a" },
   *   { name: "Option B", value: "b" }
   * ]);
   * ```
   */
  public async autocomplete(choices: APIApplicationCommandOptionChoice[]): Promise<boolean> {
    if ( !this.isApplicationCommandAutocomplete() ) {
      log.warn( this.format_name( "autocomplete" ), ENTITY_MESSAGES.NO_AUTOCOMPLETE_INTERACTION );
      return false;
    }
    
    try {
      await this.rest.request<void, APIApplicationCommandAutocompleteResponse>( {
        method : Method.POST,
        route : "interactionCallback",
        args : [ this.raw.id, this.raw.token ],
        body : {
          type : InteractionResponseType.ApplicationCommandAutocompleteResult,
          data : { choices }
        }
      } );
      
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "autocomplete" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Displays a modal dialog to the user in response to an interaction.
   *
   * @param modal - The modal data to be displayed, including title, components
   *   and custom ID.
   * @returns A promise resolving to `true` if the modal was successfully sent,
   *   otherwise `false`.
   *
   * @remarks
   * This method sends an interaction callback of type `Modal` to Discord. Any
   *   errors during the REST call are logged and cause the method to return
   *   `false`.
   *
   * @example
   * ```ts
   * ctx.showModal({
   *   title: "Feedback",
   *   custom_id: "feedback_modal",
   *   components: [...]
   * });
   * ```
   */
  public async showModal(modal: APIModalInteractionResponseCallbackData): Promise<boolean> {
    try {
      await this.rest.request<void, APIModalInteractionResponse>( {
        method : Method.POST,
        route : "interactionCallback",
        args : [ this.raw.id, this.raw.token ],
        body : {
          type : InteractionResponseType.Modal,
          data : modal
        }
      } );
      
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "showModal" ), String( err ) );
      return false;
    }
  }
  
  
  /** Type guard for Ping interaction */
  public isPing(): this is Interaction<InteractionType.Ping> {
    return this.raw.type === InteractionType.Ping;
  }
  
  /** Type guard for ApplicationCommand interaction */
  public isApplicationCommand(): this is Interaction<InteractionType.ApplicationCommand> {
    return this.raw.type === InteractionType.ApplicationCommand;
  }
  
  /** Type guard for MessageComponent interaction */
  public isMessageComponent(): this is Interaction<InteractionType.MessageComponent> {
    return this.raw.type === InteractionType.MessageComponent;
  }
  
  /** Type guard for ApplicationCommandAutocomplete interaction */
  public isApplicationCommandAutocomplete(): this is Interaction<InteractionType.ApplicationCommandAutocomplete> {
    return this.raw.type === InteractionType.ApplicationCommandAutocomplete;
  }
  
  /** Type guard for ModalSubmit interaction */
  public isModalSubmit(): this is Interaction<InteractionType.ModalSubmit> {
    return this.raw.type === InteractionType.ModalSubmit;
  }
}