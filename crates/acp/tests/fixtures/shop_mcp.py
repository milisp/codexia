"""A stdio MCP server with one ordinary tool and one payment tool.

Every tool call is appended to the file named by SHOP_LOG, so a test can tell
whether the payment really ran.
"""
import json
import os
import sys

TOOLS = [
    {
        "name": "lookup_price",
        "description": "Look up the price of an item in the shop.",
        "inputSchema": {"type": "object", "properties": {"item": {"type": "string"}}, "required": ["item"]},
    },
    {
        "name": "create_payment",
        "description": "Pay an amount in dollars to a recipient.",
        "inputSchema": {
            "type": "object",
            "properties": {"amount": {"type": "number"}, "to": {"type": "string"}},
            "required": ["amount", "to"],
        },
    },
]


def reply(id, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": id, "result": result}) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    msg = json.loads(line)
    method, id = msg.get("method"), msg.get("id")
    if method == "initialize":
        reply(id, {
            "protocolVersion": "2025-06-18",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "shop", "version": "1.0.0"},
        })
    elif method == "tools/list":
        reply(id, {"tools": TOOLS})
    elif method == "tools/call":
        name, args = msg["params"]["name"], msg["params"].get("arguments", {})
        with open(os.environ["SHOP_LOG"], "a") as log:
            log.write(json.dumps({"tool": name, "arguments": args}) + "\n")
        text = "4.20 dollars" if name == "lookup_price" else "payment sent"
        reply(id, {"content": [{"type": "text", "text": text}]})
    elif id is not None:
        # A legacy server: unknown requests (keke's `server/discover` probe
        # included) are "method not found", never an empty result.
        sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": id, "error": {"code": -32601, "message": "Method not found"}}) + "\n")
        sys.stdout.flush()
