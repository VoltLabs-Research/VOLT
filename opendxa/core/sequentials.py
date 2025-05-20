import logging

logger = logging.getLogger()

class Sequentials:
    def __init__(self, context=None):
        self.steps = []
        self.context = context or {}
        self.outputs = {}

    def register(self, name, func, depends_on=None):
        self.steps.append({
            'name': name,
            'func': func,
            'depends_on': depends_on or []
        })

    def run(self):
        for step in self.steps:
            name = step['name']
            func = step['func']
            deps = step['depends_on']
            inputs = {k: self.outputs[k] for k in deps}
            logger.debug(f'Running step: {name} (depends on: {deps})')
            result = func(self.context, **inputs)
            self.outputs[name] = result

    def get_output(self, name):
        return self.outputs.get(name)