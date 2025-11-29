import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReorderCollectionProductsParams = {
  collectionId: string;
  productPositions: Array<{ productId: string; position: number }>;
  userId: string;
};

type CommandResponse = {
  success: boolean;
  error?: {
    message: string;
  };
};

async function reorderCollectionProducts(
  params: ReorderCollectionProductsParams
): Promise<void> {
  const response = await fetch("/admin/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "reorderProductsInCollection",
      payload: params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder products: ${response.statusText}`);
  }

  const result = (await response.json()) as CommandResponse;

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to reorder products");
  }
}

export function useReorderCollectionProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCollectionProducts,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["collectionProducts"],
        refetchType: "all",
      });
    },
  });
}
