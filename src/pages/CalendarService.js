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