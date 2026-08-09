"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { MessagePreview } from "./broadcast-manager";

const TEXT_MESSAGE_LIMIT = 4096;
const CAPTION_LIMIT = 1024;
const MAX_BUTTONS = 8;

type ButtonInput = { text: string; type: "url" | "webapp"; value: string };

type Settings = {
  message_html: string;
  image_url: string | null;
  buttons: ButtonInput[];
  enabled: boolean;
};

function emptyButton(): ButtonInput {
  return { text: "", type: "webapp", value: "" };
}

export function WelcomeMessageEditor() {
  const [loading, setLoading] = useState(true);
  const [messageHtml, setMessageHtml] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [buttons, setButtons] = useState<ButtonInput[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/welcome-message")
      .then((res) => res.json())
      .then((data) => {
        const s: Settings | undefined = data.settings;
        if (s) {
          setMessageHtml(s.message_html ?? "");
          setImageUrl(s.image_url ?? null);
          setButtons(s.buttons ?? []);
          setEnabled(!!s.enabled);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error ?? "Upload failed");
        return;
      }
      setImageUrl(data.url);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function addButton() {
    setButtons((prev) => (prev.length >= MAX_BUTTONS ? prev : [...prev, emptyButton()]));
  }

  function updateButton(index: number, patch: Partial<ButtonInput>) {
    setButtons((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeButton(index: number) {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  }

  const charLimit = imageUrl ? CAPTION_LIMIT : TEXT_MESSAGE_LIMIT;
  const overLimit = messageHtml.length > charLimit;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (enabled && !messageHtml.trim()) {
      setSaveError("Message is required to enable the welcome message");
      return;
    }
    if (overLimit) {
      setSaveError(`Message is over the ${charLimit}-character limit for ${imageUrl ? "an image caption" : "a text message"}`);
      return;
    }
    for (const [i, b] of buttons.entries()) {
      if (!b.text.trim()) {
        setSaveError(`Button ${i + 1} needs button text`);
        return;
      }
      if (b.type === "url") {
        if (!b.value.trim()) {
          setSaveError(`Button ${i + 1} ("${b.text}") needs a destination URL`);
          return;
        }
        if (!/^https?:\/\//i.test(b.value.trim())) {
          setSaveError(`Button "${b.text}" needs a valid http(s) URL`);
          return;
        }
      }
      if (b.type === "webapp" && /^https?:\/\/(www\.)?(t|telegram)\.me\//i.test(b.value.trim())) {
        setSaveError(
          `Button "${b.text}" is set to "Open Mini App" but its destination is a t.me link — leave this blank to open your app's home screen, or switch the button to "Open a link" to use a t.me link.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/welcome-message", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageHtml,
          imageUrl: imageUrl || undefined,
          buttons: buttons.map((b) => ({ text: b.text.trim(), type: b.type, value: b.value.trim() })),
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save");
        return;
      }
      setSaveSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Welcome Message</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 rounded border-white/20 bg-white/5"
          />
          Enabled
        </label>
      </div>
      <p className="text-xs text-white/40">
        Sent automatically when a user sends a plain <code className="text-white/60">/start</code> with no referral
        code. Referral deep links are untouched.
      </p>

      <div>
        <label className="text-xs text-white/70">Image (optional)</label>
        {imageUrl ? (
          <div className="mt-1 flex items-center gap-3">
            <Image
              src={imageUrl}
              alt="Selected"
              width={64}
              height={64}
              className="h-16 w-16 rounded-lg border border-white/10 object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove image
            </button>
          </div>
        ) : (
          <div className="mt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              disabled={uploadingImage}
              className="block w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white hover:file:bg-white/15"
            />
            {uploadingImage && <p className="mt-1 text-xs text-white/40">Uploading...</p>}
          </div>
        )}
        {imageError && <p className="mt-1 text-xs text-red-400">{imageError}</p>}
        {imageUrl && (
          <p className="mt-1 text-xs text-white/40">
            With an image, the message is sent as its caption (limit {CAPTION_LIMIT} characters instead of {TEXT_MESSAGE_LIMIT}).
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/70">
            Message (Telegram HTML — &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;s&gt;, &lt;a href&gt;, &lt;code&gt;, &lt;pre&gt;)
          </label>
          <span className={`text-xs tabular-nums ${overLimit ? "text-red-400" : "text-white/40"}`}>
            {messageHtml.length}/{charLimit}
          </span>
        </div>
        <textarea
          value={messageHtml}
          onChange={(e) => setMessageHtml(e.target.value)}
          rows={5}
          placeholder={"👋 <b>Welcome to Raffly!</b>\n\nOpen the app to claim your first free tickets."}
          className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30 ${
            overLimit ? "border-red-500/50" : "border-white/10"
          }`}
        />
      </div>

      <div className="rounded-lg border border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-white/70">Buttons (optional)</p>
          {buttons.length < MAX_BUTTONS && (
            <button type="button" onClick={addButton} className="text-xs text-blue-400 hover:text-blue-300">
              + Add button
            </button>
          )}
        </div>
        {buttons.length === 0 && <p className="text-xs text-white/40">No buttons added.</p>}
        <div className="space-y-3">
          {buttons.map((b, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={b.text}
                  onChange={(e) => updateButton(i, { text: e.target.value })}
                  placeholder="🎟️ Open Raffly"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:border-white/30"
                />
                <select
                  value={b.type}
                  onChange={(e) => updateButton(i, { type: e.target.value as "url" | "webapp" })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
                >
                  <option value="webapp" className="bg-[#0d0d14]">
                    Open Mini App
                  </option>
                  <option value="url" className="bg-[#0d0d14]">
                    Open a link
                  </option>
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={b.value}
                  onChange={(e) => updateButton(i, { value: e.target.value })}
                  placeholder={b.type === "webapp" ? "Leave blank for home, or enter a path like /raffle" : "https://..."}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => removeButton(i)}
                  className="shrink-0 text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              {b.type === "webapp" && (
                <p className="mt-1.5 text-[11px] text-white/35">
                  Opens your Mini App directly — don&apos;t paste a t.me link here. Want a plain t.me link instead? Use &quot;Open a link&quot;.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Preview</p>
        <MessagePreview imageUrl={imageUrl} messageHtml={messageHtml} buttons={buttons} />
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
      {saveSuccess && <p className="text-xs text-green">Saved.</p>}

      <button
        type="submit"
        disabled={saving || uploadingImage}
        className="w-full rounded-lg bg-blue-500/15 px-3 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
