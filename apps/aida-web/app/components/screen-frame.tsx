type Highlight = {
  label: string;
  value: string;
};

type Panel = {
  title: string;
  items: string[];
};

type ScreenFrameProps = {
  title: string;
  description: string;
  highlights: Highlight[];
  panels: Panel[];
  actions: string[];
};

export const ScreenFrame = ({ title, description, highlights, panels, actions }: ScreenFrameProps) => {
  return (
    <div className="screen-frame">
      <header className="screen-frame__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      <div className="screen-frame__highlights">
        {highlights.map((highlight) => (
          <article key={highlight.label} className="screen-frame__card">
            <p>{highlight.label}</p>
            <strong>{highlight.value}</strong>
          </article>
        ))}
      </div>

      <div className="screen-frame__panels">
        {panels.map((panel) => (
          <article key={panel.title} className="screen-frame__panel">
            <h3>{panel.title}</h3>
            <ul>
              {panel.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <footer className="screen-frame__footer">
        <h3>Available actions</h3>
        <ul>
          {actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </footer>
    </div>
  );
};
