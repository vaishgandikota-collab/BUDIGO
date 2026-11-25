import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { Vote } from '../types';
import { getSupabase } from '../config/supabase';
import { inMemoryMeetingPoints } from './meetingPointController';
import { inMemoryMembers } from './roomController';
import { NotificationService } from '../services/notificationService';

export const inMemoryVotes = new Map<string, Vote[]>(); // roomId -> Vote[]

export class VoteController {
  static async castVote(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId, meetingPointId } = req.body;
      const userId = req.user!.id;

      if (!roomId || !meetingPointId) {
        return res.status(400).json({ success: false, error: 'roomId and meetingPointId are required' });
      }

      const supabase = getSupabase();
      if (supabase) {
        // Verify user is a member of the room
        const { data: member } = await supabase
          .from('room_members')
          .select('id')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .single();

        if (!member) {
          return res.status(403).json({ success: false, error: 'Only room members can vote' });
        }

        // Upsert vote (1 vote per user per room)
        const { data: vote, error } = await supabase
          .from('votes')
          .upsert(
            { room_id: roomId, meeting_point_id: meetingPointId, user_id: userId },
            { onConflict: 'room_id,user_id' }
          )
          .select()
          .single();

        if (error) return res.status(500).json({ success: false, error: error.message });

        // Calculate tallies
        const { data: allVotes } = await supabase.from('votes').select('*').eq('room_id', roomId);
        const tallies = VoteController.computeTallies((allVotes || []) as Vote[]);

        const { count: memberCount } = await supabase
          .from('room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId);

        const io = req.app.get('io');
        if (io) {
          io.to(`room:${roomId}`).emit('meeting:vote', {
            roomId,
            userId,
            meetingPointId,
            tallies,
          });

          if (memberCount && tallies.totalVotes >= memberCount) {
            io.to(`room:${roomId}`).emit('meeting:vote-completed', { roomId, tallies });
            await NotificationService.notifyRoom(
              roomId,
              'Voting Completed! 🗳️',
              'All members have cast their votes for the meeting point.',
              'meeting:vote-completed',
              { tallies },
              io
            );
          }
        }

        return res.json({ success: true, vote, tallies });
      }

      // Memory mode
      const members = inMemoryMembers.get(roomId) || [];
      const isMember = members.some((m) => m.user_id === userId);
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Only room members can vote' });
      }

      let roomVotes = inMemoryVotes.get(roomId) || [];
      // Remove any existing vote by this user
      roomVotes = roomVotes.filter((v) => v.user_id !== userId);

      const newVote: Vote = {
        id: `v_${Date.now()}`,
        room_id: roomId,
        meeting_point_id: meetingPointId,
        user_id: userId,
        created_at: new Date().toISOString(),
      };
      roomVotes.push(newVote);
      inMemoryVotes.set(roomId, roomVotes);

      const tallies = VoteController.computeTallies(roomVotes);

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${roomId}`).emit('meeting:vote', {
          roomId,
          userId,
          meetingPointId,
          tallies,
        });

        if (members.length > 0 && tallies.totalVotes >= members.length) {
          io.to(`room:${roomId}`).emit('meeting:vote-completed', { roomId, tallies });
          await NotificationService.notifyRoom(
            roomId,
            'Voting Completed! 🗳️',
            'All members have cast their votes for the meeting point.',
            'meeting:vote-completed',
            { tallies },
            io
          );
        }
      }

      return res.json({ success: true, vote: newVote, tallies });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRoomVotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { roomId } = req.params;
      const supabase = getSupabase();

      if (supabase) {
        const { data: votes, error } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', roomId);

        if (error) return res.status(500).json({ success: false, error: error.message });
        const tallies = VoteController.computeTallies((votes || []) as Vote[]);
        return res.json({ success: true, votes, tallies });
      }

      const votes = inMemoryVotes.get(roomId) || [];
      const tallies = VoteController.computeTallies(votes);
      return res.json({ success: true, votes, tallies });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  private static computeTallies(votes: Vote[]): {
    counts: Record<string, number>;
    percentages: Record<string, number>;
    totalVotes: number;
  } {
    const counts: Record<string, number> = {};
    const totalVotes = votes.length;

    for (const v of votes) {
      counts[v.meeting_point_id] = (counts[v.meeting_point_id] || 0) + 1;
    }

    const percentages: Record<string, number> = {};
    for (const [mpId, count] of Object.entries(counts)) {
      percentages[mpId] = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    }

    return { counts, percentages, totalVotes };
  }
}

