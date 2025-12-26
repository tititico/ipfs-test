export const parseIpfsAddResponse = (rawText: string) => {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: any[] = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }

  if (parsed.length === 0) {
    return { last: {}, cid: undefined, linesCount: 0 };
  }

  const fileEntry = parsed.find((p) => p?.Name && p.Name.length > 0) || parsed[parsed.length - 1];

  console.log('[parseIpfsAddResponse] All entries:', parsed);
  console.log('[parseIpfsAddResponse] Selected entry:', fileEntry);

  const cid: string | undefined = fileEntry?.Hash || fileEntry?.Cid || fileEntry?.cid || fileEntry?.CID;
  return { last: fileEntry, cid, linesCount: lines.length };
};

export const parseNDJSONObjects = (rawText: string) => {
  const lines = (rawText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const objs: any[] = [];
  for (const line of lines) {
    try {
      objs.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }
  return objs;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const waitForPinVisible = async (cid: string, tries = 12) => {
  console.log(`[waitForPinVisible] Waiting for CID: ${cid}`);
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`/cluster/pins/${encodeURIComponent(cid)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      console.log(`[waitForPinVisible] Try ${i + 1}: /cluster/pins/${cid} status=${r.status}`);
      if (r.ok) return true;

      const r2 = await fetch(`/cluster/pins`, { method: 'GET', cache: 'no-store' });
      if (r2.ok) {
        const text = await r2.text();
        const nd = parseNDJSONObjects(text);
        if (nd.length) {
          if (nd.some((p: any) => (p?.cid || p?.Cid || p?.CID || p?.pin?.cid) === cid)) return true;
        } else {
          try {
            const json = JSON.parse(text);
            const pins = Array.isArray(json)
              ? json
              : Array.isArray(json?.pins)
              ? json.pins
              : json && typeof json === 'object'
              ? Object.values(json)
              : [];
            if (Array.isArray(pins) && pins.some((p: any) => (p?.cid || p?.Cid || p?.CID || p?.pin?.cid) === cid))
              return true;
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.log(`[waitForPinVisible] Error:`, err);
    }
    await sleep(2000);
  }
  return false;
};