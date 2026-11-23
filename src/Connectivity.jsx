import React, { useState } from 'react';
import { Bluetooth, ChevronRight, Wifi } from 'lucide-react';

const RADIOS = [
  { id: 'wifi', label: 'Wi-Fi', Icon: Wifi, settings: 'Wi-Fi networks' },
  { id: 'bluetooth', label: 'Bluetooth', Icon: Bluetooth, settings: 'Bluetooth devices' },
];

export default function Connectivity({ system, open, setOpen, dismissOtherPanels, call }) {
  const [busy, setBusy] = useState(null);

  async function toggleRadio(id, enabled) {
    setBusy(id);
    try {
      await call(() => window.hub.radioSet(id, !enabled));
    } finally {
      setBusy(null);
    }
  }

  function openSettings(id) {
    setOpen(false);
    call(() => window.hub.openSystemSettings(id));
  }

  return (
    <div
      className="connectivity-wrap"
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        className={`connectivity-trigger ${open ? 'active' : ''}`}
        aria-label="Wi-Fi and Bluetooth"
        aria-expanded={open}
        aria-controls="connectivity-panel"
        onClick={() => {
          dismissOtherPanels();
          setOpen(!open);
        }}
      >
        <Wifi size={18} />
        <Bluetooth size={18} />
      </button>
      {open && (
        <div
          id="connectivity-panel"
          className="connectivity-popover"
          role="group"
          aria-label="Wi-Fi and Bluetooth controls"
        >
          <div className="connectivity-tiles">
            {RADIOS.map(({ id, label, Icon }) => {
              const enabled = system?.[`${id}Enabled`];
              const available = system?.[`${id}Available`];
              const detail = !available
                ? 'Unavailable'
                : !enabled
                  ? 'Off'
                  : id === 'wifi'
                    ? system?.wifiSsid || 'On · not connected'
                    : system?.bluetoothDevice || 'On · no device';
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`Turn ${label} ${enabled ? 'off' : 'on'}`}
                  aria-pressed={enabled === true}
                  disabled={!available || enabled == null || busy !== null}
                  onClick={() => toggleRadio(id, enabled)}
                >
                  <span className={`connectivity-icon ${enabled ? 'on' : ''}`}>
                    <Icon size={20} />
                  </span>
                  <strong>
                    {label} <span className="radio-state">{enabled ? 'On' : 'Off'}</span>
                  </strong>
                  <small title={detail}>{busy === id ? 'Changing…' : detail}</small>
                </button>
              );
            })}
          </div>
          {RADIOS.map(({ id, label, Icon, settings }) => (
            <button
              key={id}
              className="connectivity-link"
              onClick={() => openSettings(id)}
              aria-label={settings}
            >
              <Icon size={17} />
              <span>{settings}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
