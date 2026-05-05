"use client";

import { useState, type FormEvent } from "react";
import { DIGITAL_ANALYSTS } from "@/lib/constants";
import type { DigitalAnalyst, DigitalClientStatus } from "@/lib/types";

export interface NewClientPayload {
  name: string;
  analyst: DigitalAnalyst;
  status: DigitalClientStatus;
  start_date: string | null;
  end_date: string | null;
  total_posts_target: number | null;
  current_posts: number;
  notes: string | null;
}

interface Props {
  onCreate: (payload: NewClientPayload) => void | Promise<void>;
  onCancel: () => void;
}

export function NewClientForm({ onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [analyst, setAnalyst] = useState<DigitalAnalyst>(DIGITAL_ANALYSTS[0]);
  const [status, setStatus] = useState<DigitalClientStatus>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      name: trimmed,
      analyst,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      total_posts_target: target ? Number(target) : null,
      current_posts: current ? Number(current) : 0,
      notes: notes.trim() || null,
    });
  }

  return (
    <form className="client-form" onSubmit={handleSubmit}>
      <div className="client-form-grid">
        <label className="client-form-field">
          <span>Client name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mt. Joy"
            required
            autoFocus
          />
        </label>

        <label className="client-form-field">
          <span>Analyst</span>
          <select
            value={analyst}
            onChange={(e) => setAnalyst(e.target.value as DigitalAnalyst)}
          >
            {DIGITAL_ANALYSTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="client-form-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DigitalClientStatus)}
          >
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </label>

        <label className="client-form-field">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label className="client-form-field">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        <label className="client-form-field">
          <span>Target posts</span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            min={0}
            placeholder="1550"
          />
        </label>

        <label className="client-form-field">
          <span>Current posts</span>
          <input
            type="number"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            min={0}
            placeholder="0"
          />
        </label>
      </div>

      <label className="client-form-field client-form-notes">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Check in about renewing for next month."
        />
      </label>

      <div className="client-form-actions">
        <button type="button" className="client-form-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="client-form-submit">
          Create client
        </button>
      </div>
    </form>
  );
}
