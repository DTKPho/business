import { useGameStore } from '../game/store';

export function EventLog() {
  const log = useGameStore((s) => s.log);

  return (
    <div className="event-log">
      <h3>Journal</h3>
      <ul>
        {log.map((entry) => (
          <li key={entry.id} className={`log-${entry.kind}`}>
            <span className="log-day">J{entry.day}</span> {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
