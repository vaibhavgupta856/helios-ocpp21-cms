/**
 * OCPP 2.1 Edition 2 JSON (OCPP-J) framing
 * CALL              = [2, messageId, action, payload]
 * CALLRESULT        = [3, messageId, payload]
 * CALLERROR         = [4, messageId, errorCode, errorDescription, errorDetails]
 * CALLRESULTERROR   = [5, messageId, errorCode, errorDescription, errorDetails]  (new in 2.1)
 * SEND              = [6, messageId, action, payload]  (one-way, no response)
 *
 * Rule: at most one outstanding CALL per direction. SEND does not count.
 */

import { randomUUID } from 'crypto';

export const MessageType = {
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
  CALLRESULTERROR: 5,
  SEND: 6,
};

export const CALL = MessageType.CALL;
export const CALLRESULT = MessageType.CALLRESULT;
export const CALLERROR = MessageType.CALLERROR;
export const CALLRESULTERROR = MessageType.CALLRESULTERROR;
export const SEND = MessageType.SEND;

export const SUBPROTOCOL = 'ocpp2.1';
export const FALLBACK_SUBPROTOCOLS = ['ocpp2.1', 'ocpp2.0.1'];

export const ErrorCode = {
  FormatViolation: 'FormatViolation',
  FormationViolation: 'FormationViolation',
  GenericError: 'GenericError',
  InternalError: 'InternalError',
  MessageTypeNotSupported: 'MessageTypeNotSupported',
  NotImplemented: 'NotImplemented',
  NotSupported: 'NotSupported',
  OccurrenceConstraintViolation: 'OccurrenceConstraintViolation',
  PropertyConstraintViolation: 'PropertyConstraintViolation',
  ProtocolError: 'ProtocolError',
  RpcFrameworkError: 'RpcFrameworkError',
  SecurityError: 'SecurityError',
  TypeConstraintViolation: 'TypeConstraintViolation',
};

export function newMessageId() {
  return randomUUID();
}

export function serializeCall(action, payload, messageId = newMessageId()) {
  return [MessageType.CALL, messageId, action, payload ?? {}];
}

export function serializeCallResult(messageId, payload) {
  return [MessageType.CALLRESULT, messageId, payload ?? {}];
}

export function serializeCallError(messageId, errorCode, errorDescription = '', errorDetails = {}) {
  return [MessageType.CALLERROR, messageId, errorCode, errorDescription, errorDetails];
}

export function serializeCallResultError(messageId, errorCode, errorDescription = '', errorDetails = {}) {
  return [MessageType.CALLRESULTERROR, messageId, errorCode, errorDescription, errorDetails];
}

export function serializeSend(action, payload, messageId = newMessageId()) {
  return [MessageType.SEND, messageId, action, payload ?? {}];
}

export function stringifyFrame(frame) {
  return JSON.stringify(frame);
}

export function parseMessage(data) {
  let parsed;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(Buffer.from(data).toString('utf8'));
  } catch {
    const err = new Error('Invalid JSON frame');
    err.errorCode = ErrorCode.FormationViolation;
    throw err;
  }
  if (!Array.isArray(parsed) || parsed.length < 2) {
    const err = new Error('Invalid OCPP-J frame shape');
    err.errorCode = ErrorCode.RpcFrameworkError;
    throw err;
  }
  const type = parsed[0];
  if (type === MessageType.CALL) {
    if (parsed.length < 3 || typeof parsed[1] !== 'string' || typeof parsed[2] !== 'string') {
      const err = new Error('Invalid CALL frame');
      err.errorCode = ErrorCode.RpcFrameworkError;
      throw err;
    }
    return {
      type,
      messageId: parsed[1],
      action: parsed[2],
      payload: parsed[3] ?? {},
    };
  }
  if (type === MessageType.CALLRESULT) {
    return {
      type,
      messageId: parsed[1],
      payload: parsed[2] ?? {},
    };
  }
  if (type === MessageType.CALLERROR || type === MessageType.CALLRESULTERROR) {
    return {
      type,
      messageId: parsed[1],
      errorCode: parsed[2],
      errorDescription: parsed[3] ?? '',
      errorDetails: parsed[4] ?? {},
    };
  }
  if (type === MessageType.SEND) {
    if (parsed.length < 3 || typeof parsed[2] !== 'string') {
      const err = new Error('Invalid SEND frame');
      err.errorCode = ErrorCode.RpcFrameworkError;
      throw err;
    }
    return {
      type,
      messageId: parsed[1],
      action: parsed[2],
      payload: parsed[3] ?? {},
    };
  }
  const err = new Error(`Unknown MessageTypeId: ${type}`);
  err.errorCode = ErrorCode.MessageTypeNotSupported;
  throw err;
}

export function typeName(type) {
  if (type === MessageType.CALL) return 'CALL';
  if (type === MessageType.CALLRESULT) return 'CALLRESULT';
  if (type === MessageType.CALLERROR) return 'CALLERROR';
  if (type === MessageType.CALLRESULTERROR) return 'CALLRESULTERROR';
  if (type === MessageType.SEND) return 'SEND';
  return String(type);
}

export function parseBasicAuth(header) {
  if (!header || !String(header).startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(String(header).slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return { username: decoded, password: '' };
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}
