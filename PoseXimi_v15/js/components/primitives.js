/**
 * Minimal semantic UI building blocks. `body` is trusted markup returned by
 * in-repository renderers, never arbitrary user input.
 */
import { safe } from "../ui.js";
import { iconMarkup } from "../icons.js";

export function BaseCard({
  eyebrow = "",
  title = "",
  body = "",
  className = "",
} = {}) {
  return `<section class="px-card ${safe(className)}">
    ${eyebrow ? `<p class="px-kicker">${safe(eyebrow)}</p>` : ""}
    ${title ? `<h2 class="px-card-title">${safe(title)}</h2>` : ""}${body}
  </section>`;
}
/** @param {{label:string,action:string,icon?:string,disabled?:boolean,attrs?:string,className?:string}} options */
export function PrimaryButton({
  label,
  action,
  icon = "arrow-badge-right",
  disabled = false,
  attrs = "",
  className = "",
} = {}) {
  return `<button class="px-primary-button ${safe(className)}" type="button" data-action="${safe(action)}" ${disabled ? "disabled" : ""} ${attrs}>${safe(label)}${iconMarkup(icon)}</button>`;
}
export function TextButton({
  label,
  action,
  icon = "arrow-badge-left",
  attrs = "",
  className = "",
} = {}) {
  return `<button type="button" class="px-text-button ${safe(className)}" data-action="${safe(action)}" ${attrs}>${iconMarkup(icon)}${safe(label)}</button>`;
}
