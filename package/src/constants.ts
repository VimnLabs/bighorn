import { Snowflake } from "discord-api-types/v6";

export const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json" as const;
export const ENDPOINT = "https://discord.com/api/v10" as const;
export const CDN = "https://cdn.discordapp.com/" as const;
export const EPOCH = 1_420_070_400_000n as const

export enum SOCKET_MESSAGES {
  CONNECTED = "Connected to Discord Gateway",
  CLOSED = "The socket was closed, reason: {reason}",
  ERROR = "An error occurred in the socket, error: {error}",
  NO_SOCKET = "Socket not started or WebSocket is null.",
  DESTROYED = "The socket was destroyed intentionally.",
  ACK = "Received ACK Heartbeat.",
  RECONNECT = "Reconnecting as requested by Discord.",
  INVALID_SESSION = "Invalid session detected.",
  RESUME = "Attempting to resume the session.",
  MAX_RETRIES_EXCEEDED = "Max retries exceeded, giving up.",
  LISTENER_REPLACED = "Listener for '{event}' was replaced.",
  JSON_INVALID = "Invalid JSON received: {data}",
  PING_SENT = "Heartbeat ping sent.",
  SESSION_CLEARED = "Session store cleared.",
  SOCKET_CLOSING = "Closing WebSocket connection.",
}

export enum KEYWORDS {
  Reason = "{reason}",
  Error = "{error}",
  Event = "{event}",
  Data = "{data}",
  Kind = "{kind}",
  Action = "{action}",
  Id = "{id}",
  Part = "{part}",
  Remaining = "{remaining}"
}

export enum GENERIC_MESSAGES {
  NOT_IMPLEMENTED = "This function has not yet been implemented, please" +
    " inform about it.",
  FROM_OTHERS = "You cannot {action} from other {kind}.",
  NOT_PART = `The {kind} with the id {id} is not part of a {part}.`
}

export enum ENTITY_MESSAGES {
  NO_HASH = `It has no {kind} hash.`,
  ALREADY_DEFERRED = "This interaction has already been deferred",
  FOLLOW_UP_REMAINING = "You are sending a follow up message, you can only" +
    " send a maximum of 5 per interaction, you have {remaining} follow up messages left.",
  FOLLOW_UP_REACHED = "You have reached the maximum number of follow up messages (5 messages)."
}

type FormatSimpleEntity<Target extends string, Id extends Snowflake> = `${ Target }:${ Id }`

export function format_simple_entity<Target extends string, Id extends Snowflake>(target: Target, id: Id): FormatSimpleEntity<Target, Id> {
  return `${ target }:${ id }`
}

export function format_entity_with_sub<Target extends string, Id extends Snowflake, Sub extends string>(target: Target, id: Id, sub: Sub): `${ FormatSimpleEntity<Target, Id> }>${ Sub }` {
  return `${ format_simple_entity( target, id ) }>${ sub }`
}

export function replace(string: string, keywords: Partial<Record<KEYWORDS, string | number | boolean>>): string {
  return string.replaceAll( /{(\w+)}/g, (_: unknown, key: KEYWORDS) =>
    String( keywords[key] ?? `{${ key }}` ) )
}