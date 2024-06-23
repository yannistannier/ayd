import os

import yaml


def read_template(yaml_dir_path):
    """
    This method will read the yaml file from your dir path
    """
    directory_path = yaml_dir_path
    yaml_content = ""

    with open(directory_path, "r") as f:
        try:
            yaml_content = yaml.safe_load(f)
        except yaml.YAMLError as e:
            print(f"Error parsing {directory_path}: {e}")

    return yaml_content


prompts_config = read_template("/app/app/ds/prompts.yaml")
