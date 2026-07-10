import { customAlphabet, nanoid } from 'nanoid';

// Room codes: uppercase letters + digits, ambiguous characters (0/O, 1/I) removed.
const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const roomCodeGen = customAlphabet(ROOM_CODE_ALPHABET, 5);

export function generateRoomCode() {
  return roomCodeGen();
}

export function generateId(prefix = '') {
  return prefix ? `${prefix}_${nanoid(12)}` : nanoid(12);
}
