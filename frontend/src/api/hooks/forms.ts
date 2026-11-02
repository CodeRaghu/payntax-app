import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { keys } from "./keys";

export function useForm1040(returnId: string) {
  return useQuery({
    queryKey: keys.form1040(returnId),
    queryFn: () => unwrap(api.GET("/api/returns/{id}/form-1040", { params: { path: { id: returnId } } })),
  });
}

export function useUpdateFormLine(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ line, value }: { line: string; value: string | null }) =>
      unwrap(
        api.PATCH("/api/returns/{id}/form-1040/lines/{line}", {
          params: { path: { id: returnId, line } },
          body: { value },
        }),
      ),
    onSuccess: (form) => queryClient.setQueryData(keys.form1040(returnId), form),
  });
}

/** Same-origin URL; the browser downloads it with the session cookie. */
export const form1040PdfUrl = (returnId: string) => `/api/returns/${returnId}/form-1040.pdf`;
