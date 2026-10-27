import ChatView from '../../components/ChatView';

// Chat: same flow as the other portals — first visit asks the user to
// create their unique chat username (unique across the whole system),
// then threads and @username search work exactly as elsewhere.
export default function UserMessages() {
  return <ChatView isOwner={false} />;
}
