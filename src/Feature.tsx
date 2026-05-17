import { useEffect, useMemo, useState } from "react";
import {
  createClockSync,
  useEventLog,
  useMeshSlot,
  useNamedPeer,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Side = "pro" | "con";
type Point = { id: string; peerId: string; side: Side; text: string; ts: number; slotId: number };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="dc-screen">
        <h1>debate clock</h1>
        <p className="dc-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const phase = usePhase<"lobby" | "debate" | "done">(room, "phase", "lobby");
  const points = useEventLog<Point>(room, "points");
  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock?.destroy(), [clock]);
  const slot = useMeshSlot(clock, 60_000);

  const [, rerender] = useState(0);
  useEffect(() => {
    const sides = room.doc.getMap<Side>("sides");
    const cb = () => rerender((n) => n + 1);
    sides.observe(cb);
    return () => sides.unobserve(cb);
  }, [room]);

  const sidesMap = room.doc.getMap<Side>("sides");
  const mySide = sidesMap.get(room.peerId);
  const baselineSlot =
    (room.doc.getMap<string | number>("phase").get("baselineSlot") as number) ?? slot.slotId;
  const currentSide: Side = (slot.slotId - baselineSlot) % 2 === 0 ? "pro" : "con";
  const canSpeak = phase.phase === "debate" && mySide === currentSide;
  const [draft, setDraft] = useState("");

  const join = (side: Side) => sidesMap.set(room.peerId, side);
  const start = () => {
    room.doc.transact(() => {
      room.doc.getMap<string | number>("phase").set("baselineSlot", slot.slotId);
    });
    phase.transition("debate", { from: "lobby" });
  };
  const logPoint = () => {
    const text = draft.trim();
    if (!text || !canSpeak) return;
    points.push({
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      side: currentSide,
      text,
      ts: Date.now(),
      slotId: slot.slotId,
    });
    setDraft("");
  };
  const endDebate = () => phase.transition("done");

  const sLeft = Math.ceil(slot.slotMsRemaining / 1000);
  const proPoints = points.events.filter((p) => p.side === "pro");
  const conPoints = points.events.filter((p) => p.side === "con");

  return (
    <div className="dc-screen">
      <header className="dc-header">
        <h1>debate clock</h1>
        <p className="dc-status">
          {room.peerCount + 1} present · {phase.phase}
        </p>
      </header>

      <input
        className="dc-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={32}
        aria-label="your name"
      />

      <div className="dc-side-row" role="group" aria-label="pick side">
        <button
          type="button"
          className={`dc-side-pro${mySide === "pro" ? " is-mine" : ""}`}
          aria-label="join PRO"
          onClick={() => join("pro")}
        >
          join PRO
        </button>
        <button
          type="button"
          className={`dc-side-con${mySide === "con" ? " is-mine" : ""}`}
          aria-label="join CON"
          onClick={() => join("con")}
        >
          join CON
        </button>
      </div>

      {phase.phase === "lobby" && (
        <button type="button" className="dc-start" onClick={start} aria-label="start debate">
          start debate
        </button>
      )}

      {phase.phase !== "lobby" && (
        <>
          <div className={`dc-turn dc-turn-${currentSide}`}>
            {currentSide.toUpperCase()}'s turn · {sLeft}s
          </div>
          <div className="dc-progress" aria-hidden="true">
            <div className="dc-progress-bar" style={{ opacity: 0.3 + slot.progress * 0.7 }} />
          </div>
          <div className="dc-input-row">
            <input
              className="dc-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="your point…"
              disabled={!canSpeak}
              onKeyDown={(e) => e.key === "Enter" && logPoint()}
            />
            <button
              type="button"
              className="dc-log"
              aria-label="log point"
              onClick={logPoint}
              disabled={!canSpeak}
            >
              log point
            </button>
          </div>
          <button type="button" className="dc-end" aria-label="end debate" onClick={endDebate}>
            end debate
          </button>
        </>
      )}

      <div className="dc-transcript">
        <div className="dc-col-pro">
          <h3>PRO</h3>
          {proPoints.map((p) => (
            <div key={p.id} className="dc-point">
              <span className="dc-author">{nameOf(p.peerId) ?? "peer"}</span>
              <span className="dc-text">{p.text}</span>
            </div>
          ))}
        </div>
        <div className="dc-col-con">
          <h3>CON</h3>
          {conPoints.map((p) => (
            <div key={p.id} className="dc-point">
              <span className="dc-author">{nameOf(p.peerId) ?? "peer"}</span>
              <span className="dc-text">{p.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
