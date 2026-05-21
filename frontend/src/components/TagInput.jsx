import React, { useState, useEffect, useRef } from 'react';
import { X, Tag as TagIcon, Plus } from 'lucide-react';
import api from '../api';

const TagInput = ({ tags = [], onChange, placeholder = "選擇或輸入標籤...", singleSelect = false }) => {
    const [input, setInput] = useState('');
    const [availableTags, setAvailableTags] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchAvailableTags();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchAvailableTags = async () => {
        try {
            const resp = await api.get('/tags');
            // Clean up brackets and quotes from backend strings
            const cleanedTags = (resp.data || []).map(t => String(t).replace(/^[\["']+|[\]"']+$/g, ''));
            // Filter unique tags
            setAvailableTags([...new Set(cleanedTags)]);
        } catch (err) {
            console.error('Error fetching tags:', err);
        }
    };

    const handleAddTag = (tagName) => {
        const trimmed = tagName.trim();
        if (!trimmed) return;

        if (singleSelect) {
            onChange([trimmed]);
        } else {
            if (!tags.includes(trimmed)) {
                onChange([...tags, trimmed]);
            }
        }
        setInput('');
        setShowDropdown(false);
    };

    const handleRemoveTag = (tagName) => {
        onChange(tags.filter(t => t !== tagName));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag(input);
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            handleRemoveTag(tags[tags.length - 1]);
        }
    };

    const filteredAvailable = availableTags.filter(t =>
        !tags.includes(t) &&
        t.toLowerCase().includes(input.toLowerCase())
    );

    const inputRef = useRef(null);

    const handleContainerClick = () => {
        inputRef.current?.focus();
        setShowDropdown(true);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }} ref={dropdownRef}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 15px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: '8px',
                minHeight: '48px',
                alignItems: 'center',
                cursor: 'text',
                transition: 'border-color 0.2s, box-shadow 0.2s'
            }} onClick={handleContainerClick}>
                {tags.map((tag, idx) => (
                    <span key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 215, 0, 0.1)',
                        color: 'var(--primary-yellow)',
                        padding: '2px 8px',
                        borderRadius: '15px',
                        fontSize: '12px',
                        border: '1px solid rgba(255, 215, 0, 0.3)'
                    }}>
                        {tag}
                        <X
                            size={12}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTag(tag);
                            }}
                        />
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setShowDropdown(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={tags.length === 0 ? placeholder : ""}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        padding: '5px 0',
                        fontSize: '13px',
                        minWidth: '100px',
                        outline: 'none',
                        height: '30px' // 固定高度以確保點擊區域穩定
                    }}
                />
            </div>

            {showDropdown && (input || filteredAvailable.length > 0) && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: '#333',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    {filteredAvailable.map((tag, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleAddTag(tag)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                borderBottom: '1px solid #444',
                                color: '#fff'
                            }}
                            onMouseEnter={e => e.target.style.background = '#444'}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                            <TagIcon size={12} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {tag}
                        </div>
                    ))}
                    {input && !availableTags.includes(input) && (
                        <div
                            onClick={() => handleAddTag(input)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: 'var(--primary-yellow)'
                            }}
                            onMouseEnter={e => e.target.style.background = '#444'}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                            <Plus size={12} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            新增標籤: "{input}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TagInput;
