# coordinate-task

強いモデルがユーザーの意図を正確に汲み取り、worker が理解できる指示にして worker-advisor で依頼するパターン。`/coordinate-task` prompt はこれへの alias。

- タスクの分解と実装方針は coordinator の仕事にしない。要求が正確に伝われば、分解と方針は worker-advisor の Advisor が決める
- ユーザーへの質問は、指示が変わる点に限って 1 回にまとめ、選択肢と推奨案を付ける。ユーザーが最小の労力で意図を擦り合わせられるようにするため

本文: [PLAYBOOK.md](./PLAYBOOK.md)
