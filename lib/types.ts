export type Shape = "circle" | "square" | "triangle";
export type Color = "red" | "blue" | "green";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface UserRow {
  id: string;
  name: string;
  created_at: string;
}

export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  host_user_id: string;
  current_turn_player_id: string | null;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  errors: number;
  is_alive: boolean;
  turn_order: number;
}

export interface CombinationRow {
  id: string;
  player_id: string;
  shape: Shape;
  color: Color;
}

export interface RevelationRow {
  id: string;
  room_id: string;
  player_id: string;
  shape_known: boolean;
  color_known: boolean;
  shape: Shape | null;
  color: Color | null;
}

export interface GuessRow {
  id: string;
  room_id: string;
  attacker_id: string;
  target_id: string;
  shape: Shape;
  color: Color;
  correct: boolean;
  shape_match: boolean;
  color_match: boolean;
  created_at: string;
}

export interface GuessInput {
  shape: Shape;
  color: Color;
}

export interface Evaluation {
  correct: boolean;
  shapeMatch: boolean;
  colorMatch: boolean;
}

/** Complete miss: no partial match on either axis */
export function isCompleteMiss(evaluation: Evaluation): boolean {
  return !evaluation.correct && !evaluation.shapeMatch && !evaluation.colorMatch;
}

export function isPartialMatch(evaluation: Evaluation): boolean {
  return !evaluation.correct && (evaluation.shapeMatch || evaluation.colorMatch);
}
