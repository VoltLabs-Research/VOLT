interface NotebookStartupTabContent {
    title: string;
    description: string;
};

export const renderNotebookStartupTab = (notebookTab: Window, content: NotebookStartupTabContent): void => {
    if (notebookTab.closed) {
        return;
    }

    const { document } = notebookTab;
    document.title = content.title;
    if (!document.body) {
        return;
    }

    document.body.replaceChildren();
    document.body.style.margin = '0';
    document.body.style.minHeight = '100dvh';
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.background = 'Canvas';
    document.body.style.color = 'CanvasText';
    document.body.style.fontFamily = '"Inter Variable", Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';

    const container = document.createElement('main');
    container.style.maxWidth = '480px';
    container.style.padding = '32px';
    container.style.textAlign = 'center';

    const title = document.createElement('h1');
    title.textContent = content.title;
    title.style.margin = '0 0 12px';
    title.style.fontSize = '24px';

    const description = document.createElement('p');
    description.textContent = content.description;
    description.style.margin = '0';
    description.style.fontSize = '14px';
    description.style.lineHeight = '1.5';
    description.style.color = 'GrayText';

    container.append(title, description);
    document.body.append(container);
};
