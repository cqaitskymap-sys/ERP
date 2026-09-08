import { toast as sonner } from "sonner";

export const toast = {
  success(message: string, description?: string) {
    return sonner.success(message, { description });
  },
  error(message: string, description?: string) {
    return sonner.error(message, { description });
  },
  info(message: string, description?: string) {
    return sonner.info(message, { description });
  },
  warning(message: string, description?: string) {
    return sonner.warning(message, { description });
  },
  loading(message: string) {
    return sonner.loading(message);
  },
  dismiss(id?: string | number) {
    sonner.dismiss(id);
  },
};
