import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import './CommentSheet.css';

export default function CommentSheet({ postId, open, onClose, initialCount = 0, onCountChange }) {
  const { currentUser, showToast } = useApp();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open || !postId) return;
    api.getComments(postId)
      .then((items) => {
        setComments(items);
        onCountChange?.(items.length);
      })
      .catch(() => {});
  }, [open, postId]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    try {
      const saved = await api.addComment(postId, text);
      const comment = saved || { id: `${Date.now()}`, author: { handle: currentUser?.handle || '@you' }, text };
      setComments((items) => [comment, ...items]);
      setDraft('');
      onCountChange?.(comments.length + 1);
      showToast('Comment added', 'chat_bubble');
    } catch (error) {
      showToast('Unable to add comment. Please try again.', 'error');
    }
  };

  return (
    <div className="comment-sheet-backdrop" onClick={onClose} role="presentation">
      <section className="comment-sheet" aria-label="Comments" onClick={(event) => event.stopPropagation()}>
        <header className="comment-sheet-header">
          <h3>Comments</h3>
          <button type="button" className="comment-sheet-close" onClick={onClose} aria-label="Close comments">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="comment-list">
          {comments.length === 0 ? (
            <p className="comment-empty">Be the first to share what you think.</p>
          ) : comments.map((comment) => (
            <div className="comment-item" key={comment.id}>
              <strong>{comment.author?.handle || comment.author}</strong>
              <span>{comment.text}</span>
            </div>
          ))}
        </div>
        <form className="comment-composer" onSubmit={submit}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            placeholder="Add a comment..."
            aria-label="Add a comment"
          />
          <button type="submit" disabled={!draft.trim()}>Post</button>
        </form>
      </section>
    </div>
  );
}
