from skops.io import load


def init_eval_message_type_model(model_path: str):
    global eval_message_type_model
    eval_message_type_model = load(model_path, trusted=True)


def get_eval_message_type_model():
    global eval_message_type_model
    return eval_message_type_model
