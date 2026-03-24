export type BoardMembersBaseData = {
    user_id: number
    board_id: number
};

export type ListBoardsForUser = Pick<BoardMembersBaseData, 'user_id'>;
export type GetAllMembersForBoard = Pick<BoardMembersBaseData, 'board_id'>;
export type AddBoardMembers = {
    board_id: number;
    user_ids: number[];
};
export type RemoveBoardMember = BoardMembersBaseData;
export type GetMemberById = BoardMembersBaseData;

export type AddBoardMembersResponse = {
    addedCount: number;
};
