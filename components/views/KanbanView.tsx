'use client';

import { useStore, StatusType, Post } from '@/store/useStore';
import { useStorePersistent } from '@/store/useStorePersistent';
import { StatusBadge, PillarBadge, FunnelBadge } from '../Badges';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';



function SortablePostCard({ post, onClick }: { post: Post; onClick: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: post.id, data: { status: post.status } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 cursor-grab active:cursor-grabbing transition-colors ${isDragging ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-900' : ''}`}
        >
            <p className="text-sm font-bold text-text-main dark:text-gray-100 leading-snug mb-3 break-words">{post.idea}</p>
            <div className="flex items-center gap-2 mb-3">
                <PillarBadge pillar={post.pillar} />
                <FunnelBadge funnel={post.funnel} />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">{post.type}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>{post.postDate}</span>
                </div>
            </div>
        </div>
    );
}

function DroppableColumn({ column, posts, onPostClick, t }: { column: { name: string, color: string }, posts: Post[], onPostClick: (post: Post) => void, t: Record<string, string> }) {
    const { setNodeRef } = useSortable({
        id: column.name,
        data: { type: 'Column', column },
    });

    return (
        <div className="flex-shrink-0 w-[300px] flex flex-col pt-1 snap-start h-full max-h-full">
            <div className="flex items-center justify-between mb-4 px-2 flex-shrink-0">
                <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 shadow-sm text-white`}
                    style={{ backgroundColor: column.color }}
                >
                    {column.name}
                </span>
                <span className="text-xs text-text-muted font-bold bg-background-light dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-border-subtle">{posts.length}</span>
            </div>
            <div
                ref={setNodeRef}
                className="flex-1 space-y-3 min-h-[200px] p-1 -mx-1 overflow-y-auto custom-scrollbar"
            >
                <SortableContext items={posts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {posts.map((post) => (
                        <SortablePostCard key={post.id} post={post} onClick={() => onPostClick(post)} />
                    ))}
                </SortableContext>

                {posts.length === 0 && (
                    <div className="min-h-[100px] border-2 border-dashed border-border-subtle rounded-xl flex items-center justify-center text-center text-text-muted bg-background-light/50 dark:bg-gray-800/50">
                        <p className="text-xs font-bold tracking-wide">{t.kanban_drop_here}</p>
                    </div>
                )}
            </div>
        </div>
    );
}


export default function KanbanView({ posts }: { posts: Post[] }) {
    const { openDrawer, statuses } = useStore();
    const updatePostStatus = useStore((state) => state.updatePostStatus);
    const [activeId, setActiveId] = useState<string | null>(null);
    const t = useT();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );


    if (posts === undefined) {
        return null;
    }

    const handleDragStart = (event: any) => {
        const { active } = event;
        setActiveId(active.id as string);
    };

    const handleDragOver = (event: any) => {
        // We aren't implementing re-ordering within the same column perfectly yet.
        // Zustand doesn't have an "order" field, so we just focus on status changes.
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activePost = posts.find(p => p.id === activeId);

        let newStatus: StatusType | null = null;

        // Is it dropping over a column?
        const isOverColumn = statuses.some(c => c.name === overId);
        if (isOverColumn) {
            newStatus = overId as StatusType;
        } else {
            // Is it dropping over another card?
            const overPost = posts.find((p) => p.id === overId);
            if (overPost) {
                newStatus = overPost.status;
            }
        }

        if (activePost && newStatus && activePost.status !== newStatus) {
            updatePostStatus(activePost.id, newStatus);
            toast.success(`${t.kanban_status_updated} ${newStatus}`);
        }
    };

    const activePost = activeId ? posts.find(p => p.id === activeId) : null;

    return (
        <div className="px-1 pb-4 snap-x snap-mandatory scroll-pl-1 overflow-x-auto flex-1 min-h-0 flex custom-scrollbar">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-6 h-full w-max">
                    <SortableContext items={statuses.map(c => c.name)} strategy={verticalListSortingStrategy}>
                        {statuses.map((col) => {
                            const colPosts = posts.filter((p) => p.status === col.name);
                            return (
                                <DroppableColumn
                                    key={col.name}
                                    column={col}
                                    posts={colPosts}
                                    onPostClick={openDrawer}
                                    t={t}
                                />
                            );
                        })}
                    </SortableContext>
                </div>

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.4',
                            },
                        },
                    }),
                }}>
                    {activePost ? (
                        <div className="bg-surface-white dark:bg-gray-900 border-2 border-primary/50 rounded-xl p-4 shadow-xl rotate-3 opacity-90 cursor-grabbing w-72">
                            <p className="text-sm font-bold text-text-main dark:text-gray-100 leading-snug mb-3 break-words">{activePost.idea}</p>
                            <div className="flex items-center gap-2 mb-3">
                                <PillarBadge pillar={activePost.pillar} />
                                <FunnelBadge funnel={activePost.funnel} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">{activePost.type}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold">
                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                    <span>{activePost.postDate}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
