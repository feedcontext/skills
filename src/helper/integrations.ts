import { apiCall } from "./api";

export function printTelegramStatus() {
  return apiCall({ method: "GET", path: "/v1/integrations/telegram" });
}

export function printTelegramBindingLink() {
  return apiCall({
    confirm: true,
    method: "POST",
    path: "/v1/integrations/telegram/binding-link",
  });
}

export function disconnectTelegram(options: { confirm?: boolean }) {
  return apiCall({
    confirm: options.confirm,
    method: "DELETE",
    path: "/v1/integrations/telegram",
  });
}
