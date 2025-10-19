import { supabase } from "@/integrations/supabase/client";

export type ConversationRow = {
  peer_id: string;
  last_seq: number;
  last_content: string | null;
  last_image_url: string | null;
  last_sender: string;
  last_status: 'sent' | 'delivered' | 'seen';
  last_created_at: string;
  unread_count: number;
};

export async function fetchConversations() {
  // Step 1: Try RPC first
  let rows: ConversationRow[] = [];
  try {
    const { data, error } = await supabase.rpc('get_conversations');
    if (error) throw error;
    
    // The RPC returns the correct structure now
    rows = (data ?? []).map((item: any) => ({
      peer_id: item.peer_id,
      last_seq: item.last_seq,
      last_content: item.last_content,
      last_image_url: item.last_image_url,
      last_sender: item.last_sender,
      last_status: item.last_status,
      last_created_at: item.last_created_at,
      unread_count: item.unread_count,
    }));
    
    console.log('fetchConversations: RPC succeeded with', rows.length, 'conversations');
  } catch (e) {
    console.warn('RPC get_conversations failed, using fallback:', e);
  }

  // Step 2: Fallback - manually build from recent messages
  if (!rows || rows.length === 0) {
    const me = (await supabase.auth.getUser()).data.user?.id;
    if (!me) {
      console.log('fetchConversations: No authenticated user');
      return { rows: [], profiles: {} as Record<string, any> };
    }

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id,sender_id,receiver_id,content,image_url,status,created_at,seq_num,is_read')
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .order('seq_num', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Fallback messages query failed:', error);
      return { rows: [], profiles: {} as Record<string, any> };
    }

    console.log('fetchConversations: Fallback building from', msgs?.length || 0, 'messages');

    const map = new Map<string, ConversationRow>();

    // Build conversation map (latest message per peer)
    for (const m of msgs ?? []) {
      const peer = m.sender_id === me ? m.receiver_id : m.sender_id;
      if (!map.has(peer)) {
        map.set(peer, {
          peer_id: peer,
          last_seq: m.seq_num,
          last_content: (m.content ?? '') as string,
          last_image_url: (m.image_url ?? '') as string,
          last_sender: m.sender_id,
          last_status: (m.status ?? 'sent') as any,
          last_created_at: m.created_at,
          unread_count: 0,
        });
      }
    }

    // Calculate unread counts
    for (const m of msgs ?? []) {
      const peer = m.sender_id === me ? m.receiver_id : m.sender_id;
      if (m.sender_id !== me && m.receiver_id === me && m.is_read === false) {
        const r = map.get(peer);
        if (r) r.unread_count += 1;
      }
    }

    rows = Array.from(map.values()).sort((a, b) => b.last_seq - a.last_seq);
    console.log('fetchConversations: Fallback built', rows.length, 'conversations');
  }

  // Step 3: Fetch profiles (non-fatal)
  const ids = rows.map(r => r.peer_id);
  let profiles: Record<string, any> = {};
  
  if (ids.length > 0) {
    try {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, school, major')
        .in('user_id', ids);

      if (pErr) {
        console.warn('Profile fetch failed (non-fatal):', pErr);
      } else {
        (profs ?? []).forEach(p => (profiles[p.user_id] = p));
      }
    } catch (e) {
      console.warn('Profile fetch exception (non-fatal):', e);
    }
  }

  return { rows, profiles };
}

export async function fetchThread(me: string, peerId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${me})`)
    .order('seq_num', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function markThreadRead(me: string, peerId: string) {
  const { error } = await supabase.rpc('mark_thread_read', { p_user: peerId });
  if (error) console.warn('markThreadRead error:', error);
}

export async function sendMessage({
  me,
  peerId,
  text,
  file,
  bucket = 'Uploads',
}: {
  me: string;
  peerId: string;
  text: string;
  file?: File | null;
  bucket?: string;
}) {
  let image_url: string | null = null;

  if (file) {
    const key = `messages/${me}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, file, { upsert: false });
    
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    image_url = data.publicUrl ?? key;
  }

  const { data, error } = await supabase.rpc('send_message', {
    p_receiver: peerId,
    p_content: text ?? '',
    p_image_url: image_url,
    p_client_id: crypto.randomUUID(),
  });

  if (error) throw error;
  return data;
}
