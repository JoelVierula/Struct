import { supabase } from '../supabaseClient';

/* GET CURRENT USER */

async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user;
}

/* FETCH EVENTS FOR CURRENT USER */

export async function fetchEvents() {
  const user = await getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return data;
}

/* CREATE EVENT */

export async function createEvent(event) {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('events')
    .insert([
      {
        ...event,
        user_id: user.id
      }
    ])
    .select();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }

  return data[0];
}

/* DELETE EVENT */

export async function deleteEvent(id) {
  const user = await getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting event:', error);
    return false;
  }

  return true;
}

/* FETCH SCHEDULE ITEMS */

export async function fetchScheduleItems() {
  const user = await getUser();
  if (!user) return [];

  // 1. Get all schedule-type categories for this user
  const { data: scheduleCats, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'schedule');

  if (catError) {
    console.error('Error fetching schedule categories:', catError);
    return [];
  }

  if (!scheduleCats || scheduleCats.length === 0) return [];

  const scheduleCatIds = scheduleCats.map(c => c.id);

  // 2. Get item_values for those categories that have a value
  const { data: scheduleValues, error: valError } = await supabase
    .from('item_values')
    .select('*')
    .eq('user_id', user.id)
    .in('category_id', scheduleCatIds)
    .not('value', 'is', null)
    .neq('value', '');

  if (valError) {
    console.error('Error fetching schedule values:', valError);
    return [];
  }

  if (!scheduleValues || scheduleValues.length === 0) return [];

  const itemIds = [...new Set(scheduleValues.map(v => v.item_id))];

  // 3. Get the full items
  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .in('id', itemIds);

  if (itemError) {
    console.error('Error fetching items:', itemError);
    return [];
  }

  // 4. Get all item_values for these items (to show full item in modal)
  const { data: allValues, error: allValError } = await supabase
    .from('item_values')
    .select('*')
    .eq('user_id', user.id)
    .in('item_id', itemIds);

  if (allValError) {
    console.error('Error fetching all item values:', allValError);
    return [];
  }

  // 5. Get all categories for these items (to show labels in modal)
  const allCatIds = [...new Set(allValues.map(v => v.category_id))];

  const { data: allCats, error: allCatError } = await supabase
    .from('categories')
    .select('*')
    .in('id', allCatIds);

  if (allCatError) {
    console.error('Error fetching all categories:', allCatError);
    return [];
  }

  // 6. Assemble result — one entry per schedule value
  return scheduleValues.map(sv => {
    const datetime = new Date(sv.value);
    const item = items.find(i => i.id === sv.item_id);
    const cat = scheduleCats.find(c => c.id === sv.category_id);
    const itemValues = allValues.filter(v => v.item_id === sv.item_id);

    const fields = itemValues.map(iv => {
      const category = allCats.find(c => c.id === iv.category_id);
      return {
        categoryTitle: category?.title || '',
        categoryType: category?.type || 'own',
        value: iv.value
      };
    });

    return {
      id: sv.id,
      itemId: sv.item_id,
      itemTitle: item?.title || '',
      categoryTitle: cat?.title || '',
      datetime,
      date: datetime.toISOString().split('T')[0],
      hour: datetime.getHours(),
      minute: datetime.getMinutes(),
      fields,
      isScheduleItem: true
    };
  });
}