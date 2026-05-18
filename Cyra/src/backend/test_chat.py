import asyncio

import httpx


async def main() -> None:
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        response = await client.post(
            "/api/chat",
            json={"session_id": "demo", "message": "请介绍一下这个景区适合先看哪里"},
        )
        response.raise_for_status()
        print(response.json())


if __name__ == "__main__":
    asyncio.run(main())
