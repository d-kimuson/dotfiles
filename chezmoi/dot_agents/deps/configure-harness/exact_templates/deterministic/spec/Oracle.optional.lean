import Lean.Data.Json

open Lean

/-
Evaluates the spec's definitions for differential tests. Reads one JSON object per line from stdin,
`{"fn": <name>, "args": <arguments>}`, and writes the result as one line of JSON, or `{"error": <message>}`.

To make a definition testable, import its module, derive FromJson/ToJson for the types it takes and returns,
and add a case. For example:

  import src.cart.«cart-total»
  deriving instance FromJson, ToJson for CartTotal.Line
  | "CartTotal.total" => return toJson (CartTotal.total (← fromJson? (← input.getObjVal? "args")))
-/

def evalCase (input : Json) : Except String Json := do
  match ← input.getObjValAs? String "fn" with
  | name => throw s!"unknown function: {name}"

def main : IO Unit := do
  let stdin ← IO.getStdin
  let stdout ← IO.getStdout
  repeat
    let line ← stdin.getLine
    if line.isEmpty then break
    match Json.parse line >>= evalCase with
    | .ok output => stdout.putStrLn output.compress
    | .error message => stdout.putStrLn (Json.mkObj [("error", message)]).compress
    stdout.flush
