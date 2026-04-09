import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// ---------------- FETCH CATEGORIES (Optimized) ----------------
export const fetchCategories = async (listingId, itemId = null) => {
  try {
    // 1️⃣ Fetch all categories for this listing
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('listing_uuid', listingId)
      .order('order', { ascending: true });

    if (catError) throw catError;
    if (!categories) return [];

    // 2️⃣ If no itemId, return only global categories
    if (!itemId) {
      return categories.filter(cat => cat.is_global);
    }

    // 3️⃣ Fetch only the item_values relevant to this item
    const { data: values, error: valError } = await supabase
      .from('item_values')
      .select('*')
      .eq('item_id', itemId)
      .in('category_id', categories.map(c => c.id));

    if (valError) throw valError;

    // 4️⃣ Attach the item_values to their categories
    const enriched = categories.map(cat => ({
      ...cat,
      item_values: values.filter(v => v.category_id === cat.id)
    }));

    // 5️⃣ Return categories that are either global OR have a value
    return enriched.filter(cat => cat.is_global || cat.item_values.length > 0);

  } catch (err) {
    console.error("Error fetching categories:", err);
    return [];
  }
};

// ---------------- FETCH ITEMS ----------------
export const fetchItems = async (listingId) => {
  const { data, error } = await supabase
    .from("items")
    .select(`
      id,
      title,
      created_at,
      listing_uuid,
      item_values ( id, value, category_id )
    `)
    .eq("listing_uuid", listingId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// ---------------- CREATE ITEM ----------------
export const createItem = async (title, categories, listingId, categoryValues) => {
  const itemUuid = uuidv4();

  const { data: item, error } = await supabase
    .from("items")
    .insert({ 
      id: itemUuid,
      title,
      listing_uuid: listingId
    })
    .select()
    .single();

  if (error) throw error;

  // Only insert values that are non-empty
  const valuesToInsert = categories
    .filter(cat => categoryValues?.[cat.id]?.trim())
    .map(cat => ({
      id: uuidv4(),
      item_id: item.id,
      category_id: cat.id,
      value: categoryValues[cat.id],
    }));

  if (valuesToInsert.length > 0) {
    const { error: valuesError } = await supabase
      .from("item_values")
      .insert(valuesToInsert);

    if (valuesError) throw valuesError;
  }

  return item;
};

// ---------------- ADD CATEGORY ----------------
export const addCategory = async (title, items, listingId, isGlobal = true) => {
  const categoryUuid = uuidv4();

  const { data, error } = await supabase
    .from("categories")
    .insert({ 
      id: categoryUuid, 
      title, 
      listing_uuid: listingId,
      is_global: isGlobal 
    })
    .select()
    .single();

  if (error) throw error;

  // ✅ With lock/unlock system, do NOT create empty item_values automatically
  return data;
};

// ---------------- DELETE ITEM(S) ----------------
export const deleteItem = async (itemId) => {
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
};

export const deleteItems = async (itemIds) => {
  const { error } = await supabase
    .from("items")
    .delete()
    .in("id", itemIds);

  if (error) throw error;
};

// ---------------- DELETE CATEGORY ----------------
export const deleteCategory = async (categoryId) => {
  // 1️⃣ delete all values tied to category
  const { error: valError } = await supabase
    .from("item_values")
    .delete()
    .eq("category_id", categoryId);

  if (valError) throw valError;

  // 2️⃣ delete category
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) throw error;
};

// ---------------- UPDATE VALUE ----------------
export const updateValue = async (valueId, value) => {
  const { error } = await supabase
    .from("item_values")
    .update({ value })
    .eq("id", valueId);

  if (error) throw error;
};