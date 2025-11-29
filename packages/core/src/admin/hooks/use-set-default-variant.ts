import { useMutation, useQueryClient } from "@tanstack/react-query";

type SetDefaultVariantParams = {
  productId: string;
  variantId: string;
  expectedVersion: number;
  userId: string;
};

type CommandResponse = {
  success: boolean;
  error?: {
    message: string;
  };
};

async function setDefaultVariant(
  params: SetDefaultVariantParams
): Promise<void> {
  const response = await fetch("/admin/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "setDefaultVariant",
      payload: params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to set default variant: ${response.statusText}`);
  }

  const result = (await response.json()) as CommandResponse;

  if (!result.success) {
    throw new Error(result.error?.message || "Failed to set default variant");
  }
}

export function useSetDefaultVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultVariant,
    onSuccess: () => {
      // Invalidate product variants to update the defaultVariantId display
      queryClient.invalidateQueries({
        queryKey: ["productVariants"],
        refetchType: "all",
      });
      // Invalidate products since defaultVariantId is stored on product
      queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: "all",
      });
    },
  });
}
