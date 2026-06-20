import { api } from "../lib/api.js";

// Friend/contact actions (send request, accept, remove/decline/cancel), lifted
// out of ChatApp verbatim. Returns plain handlers rebuilt each render so they
// always see the latest setters (which are stable anyway).
export function useContactActions({ setAllUsers, setOnlineIds }) {
  async function handleSendRequest(contactId) {
    setAllUsers((prev) =>
      prev.map((u) =>
        u.id === contactId ? { ...u, contact_status: "pending_sent" } : u,
      ),
    );
    try {
      await api.sendContactRequest(contactId);
      api.getUsers().then(setAllUsers).catch(console.error);
    } catch (err) {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === contactId ? { ...u, contact_status: null } : u,
        ),
      );
      throw err;
    }
  }

  async function handleAcceptContact(requesterId) {
    try {
      await api.acceptContact(requesterId);
      const users = await api.getUsers();
      setAllUsers(users);
      setOnlineIds(new Set(users.filter((u) => u.online).map((u) => u.id)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveContact(contactId) {
    try {
      await api.removeContact(contactId);
      api.getUsers().then(setAllUsers).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  return { handleSendRequest, handleAcceptContact, handleRemoveContact };
}
