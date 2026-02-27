// // components/CategoryReorderManager.tsx
// import { useReorderCategories } from '@/lib/mutations/useReorderCategories';
// import { useQueryClient } from '@tanstack/react-query';
// import { useState } from 'react';

// interface Props {
//   boardId: string;
//   categoryOrder: number[];
//   setCategoryOrder: (order: number[]) => void;
// }

// export default function CategoryReorderManager({ boardId, categoryOrder, setCategoryOrder }: Props) {
//   const [unsavedOrder, setUnsavedOrder] = useState<number[] | null>(null);
//   const reorderCategories = useReorderCategories(boardId);
//   const queryClient = useQueryClient();

//   const handleSave = () => {
//     if (!unsavedOrder) return;

//     reorderCategories.mutate(
//       { newOrder: unsavedOrder },
//       {
//         onMutate: async (variables) => {
//           await queryClient.cancelQueries({ queryKey: ['categories', boardId] });
//           const prev = queryClient.getQueryData(['categories', boardId]);
//           if (prev) {
//             const newCategories = variables.newOrder.map(id =>
//               (prev as any).find((c: any) => c.id === id)
//             );
//             queryClient.setQueryData(['categories', boardId], newCategories);
//           }
//           return { prev };
//         },
//         onError: (_, __, context) => {
//           if (context?.prev) queryClient.setQueryData(['categories', boardId], context.prev);
//         },
//         onSettled: () => queryClient.invalidateQueries({ queryKey: ['categories', boardId] }    ),
//         onSuccess: () => setUnsavedOrder(null),
//       }
//     );
//   };

//   return (
//     <>
//       {/* Save button */}
//       {unsavedOrder && (
//         <button onClick={handleSave} className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
//           Save Changes
//         </button>
//       )}
//     </>
//   );
// }
