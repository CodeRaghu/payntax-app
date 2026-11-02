import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../client";
import { PROCESSING_STATUSES, type Document, type DocumentDetail, type UploadContentType } from "../types";
import { keys } from "./keys";

const isProcessing = (documents: Document[] | undefined) =>
  documents?.some((d) => PROCESSING_STATUSES.includes(d.status)) ?? false;

/** SCR-07: polls every 2 s while any document is still processing (status updates without reload). */
export function useDocuments(returnId: string) {
  return useQuery({
    queryKey: keys.documents(returnId),
    queryFn: () => unwrap(api.GET("/api/documents", { params: { query: { tax_return: returnId } } })),
    refetchInterval: (query) => (isProcessing(query.state.data) ? 2000 : false),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: keys.document(id),
    queryFn: () => unwrap(api.GET("/api/documents/{id}", { params: { path: { id } } })),
    // Pre-signed file URLs expire after 5 minutes; refresh before that.
    staleTime: 60_000,
    refetchInterval: 4 * 60_000,
  });
}

export type UploadProgress = (fraction: number) => void;

/** Two-step upload: register with the API, PUT the bytes straight to storage, then tell the API it's done. */
export async function uploadDocument(returnId: string, file: File, onProgress: UploadProgress): Promise<Document> {
  const { document, upload } = await unwrap(
    api.POST("/api/documents", {
      body: {
        tax_return: returnId,
        filename: file.name,
        content_type: file.type as UploadContentType,
        size: file.size,
      },
    }),
  );
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    Object.entries(upload.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(file);
  });
  onProgress(1);
  return unwrap(api.POST("/api/documents/{id}/complete", { params: { path: { id: document.id } } }));
}

export function useInvalidateDocuments(returnId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: keys.documents(returnId) });
    queryClient.invalidateQueries({ queryKey: keys.taxReturn(returnId) });
  };
}

export function useRetryDocument(returnId: string) {
  const invalidate = useInvalidateDocuments(returnId);
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/documents/{id}/retry", { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

export function useDeleteDocument(returnId: string) {
  const invalidate = useInvalidateDocuments(returnId);
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/documents/{id}", { params: { path: { id } } })),
    onSuccess: invalidate,
  });
}

function useDocumentMutation<TVars>(
  documentId: string,
  returnId: string,
  fn: (vars: TVars) => Promise<DocumentDetail>,
) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDocuments(returnId);
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.document(documentId), detail);
      queryClient.invalidateQueries({ queryKey: keys.form1040(returnId) });
      invalidate();
    },
  });
}

const run = (id: string, fieldId: string, body: { value?: string; acknowledged?: boolean }) =>
  unwrap(api.PATCH("/api/documents/{id}/fields/{field_id}", { params: { path: { id, field_id: fieldId } }, body }));

export function useUpdateField(documentId: string, returnId: string) {
  return useDocumentMutation(documentId, returnId, (vars: { fieldId: string; value?: string; acknowledged?: boolean }) =>
    run(documentId, vars.fieldId, { value: vars.value, acknowledged: vars.acknowledged }),
  );
}

export function useMarkReviewed(documentId: string, returnId: string) {
  return useDocumentMutation(documentId, returnId, () =>
    unwrap(api.POST("/api/documents/{id}/mark-reviewed", { params: { path: { id: documentId } } })),
  );
}

export function useRevealSensitive(documentId: string) {
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/documents/{id}/reveal-sensitive", { params: { path: { id: documentId } } })),
  });
}
