def calculate_total(items):
    """Calculate the total of a list of numbers"""
    return sum(items)

def calculate_average(items):
    """Calculate the average of a list of numbers"""
    if not items:
        return 0
    return calculate_total(items) / len(items)