export default function PageHeader({ title, subtitle, actions, tour }) {
  return (
    <div className="page-head" data-tour={tour || undefined}>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-head-actions">{actions}</div>
    </div>
  );
}
