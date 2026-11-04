// Hand-written Kysely row types for `db/schema.sql`.
//
// Update by hand whenever `db/schema.sql` changes: each column mirrors its SQL type
// (`text` -> `string`, `integer` -> `number`) and nullability mirrors `NOT NULL`.
// A column with a DEFAULT is `Generated<T>` so inserts may omit it.
import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface TodoTable {
  id: string;
  title: string;
  done: Generated<number>;
  createdAt: string;
}

export type Todo = Selectable<TodoTable>;
export type NewTodo = Insertable<TodoTable>;
export type TodoUpdate = Updateable<TodoTable>;

export interface Database {
  todo: TodoTable;
}
