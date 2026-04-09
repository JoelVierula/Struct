// todoLogic.js
import { supabase } from '../supabaseClient';

// Fetch all todo lists from Supabase
export const fetchItems = async (setItems, setLoading) => {
  setLoading(true);

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('id', { ascending: true });

  if (!error) {
    setItems(data || []);
  } else {
    console.error('Failed to fetch todo lists:', error);
  }

  setLoading(false);
};

// Add a new todo list
export const addItem = async (
  taskText,
  items,
  setItems,
  setModalText,
  setModalOpen
) => {
  if (!taskText.trim()) return;

  const { data, error } = await supabase
    .from('todos')
    .insert([{ task: taskText }])
    .select();

  if (!error && data?.length > 0) {
    setItems([...items, data[0]]);
    setModalText('');
    setModalOpen(false);
  } else if (error) {
    console.error('Failed to add todo list:', error);
  }
};

// Delete a whole listing
// Thanks to ON DELETE CASCADE in Supabase,
// this automatically deletes related:
// - items
// - categories
// - item_values
export const deleteListing = async (
  itemToDelete,
  items,
  setItems,
  setDeleteModalOpen,
  setItemToDelete
) => {
  if (!itemToDelete) return;

  try {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('uuid_id', itemToDelete.uuid_id);

    if (error) throw error;

    // Update frontend state
    setItems(
      items.filter(
        i => i.uuid_id !== itemToDelete.uuid_id
      )
    );
  } catch (err) {
    console.error('Failed to delete listing:', err);
  }

  setDeleteModalOpen(false);
  setItemToDelete(null);
};