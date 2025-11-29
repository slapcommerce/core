import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReorderProductVariantsParams = {
  productId: string;
  variantPositions: Array<{ variantId: string; position: number }>;
  userId: string;
};

type CommandResponse = {
  success: boolean;
  error?: {
    message: string;
  };
};

async function reorderProductVariants(
  params: ReorderProductVariantsParams
): Promise<void> {
  const response = await fetch("/admin/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "reorderVariantsInProduct",
      payload: params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder variants: ${response.statusText}`);
  }

  const result = (await response.json()) as CommandResponse;

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to reorder variants");
  }
}

export function useReorderProductVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderProductVariants,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all",
      });
    },
  });
}
