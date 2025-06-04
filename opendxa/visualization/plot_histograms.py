import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

def plot_histogram(data, bins=50, title='', xlabel='', ylabel='Frequency'):
    plt.figure()
    plt.hist(data, bins=bins)
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.tight_layout()
    return plt

def plot_burgers_histogram(burgers_hist):
    labels = list(burgers_hist.keys())
    counts = [burgers_hist[k] for k in labels]
    fig, ax = plt.subplots()
    ax.bar(range(len(labels)), counts, tick_label=labels)
    plt.rcParams.update({'font.size': 14, 'font.family': 'serif'})
    ax.set_title('Burgers Vector Histogram')
    ax.set_ylabel('Count')
    ax.set_xlabel('Burgers Vector')
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    plt.xticks(rotation=90)
    plt.tight_layout()
    return plt