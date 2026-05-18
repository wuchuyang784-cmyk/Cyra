import re


def infer_expression(text: str) -> str:
    if re.search(r"危险|注意|小心|禁止|严禁|不要|安全|湿滑|拥挤", text):
        return "serious"
    if re.search(r"欢迎|推荐|很适合|精彩|有趣|祈福|祝愿|不妨", text):
        return "smile"
    return "neutral"
