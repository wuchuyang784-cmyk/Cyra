from app.services import visitor_metrics


visitor_metrics.reset_question_metrics()

visitor_metrics.record_visitor_question("灵山大佛怎么走？")
visitor_metrics.record_visitor_question("帮我安排一条半日游览路线")
visitor_metrics.record_visitor_question("梵宫有什么看点？")
visitor_metrics.record_visitor_question("这张图是什么？", has_image=True)
visitor_metrics.record_visitor_question("")

questions = visitor_metrics.get_frequent_questions(limit=5)
by_category = {item["category"]: item for item in questions}

assert questions[0]["category"] == "路线推荐"
assert questions[0]["question"] == "游览路线怎么安排？"
assert questions[0]["count"] == 2
assert by_category["景点讲解"]["count"] == 1
assert by_category["景点讲解"]["question"] == "景点有什么看点？"
assert by_category["图片识别"]["count"] == 1
assert by_category["图片识别"]["question"] == "这张图片是什么？"
assert all(item["count"] > 0 for item in questions)
assert all(item["question"].endswith("？") for item in questions)

print("Visitor question metrics contract passed")
