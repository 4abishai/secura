package com.secura.repository;


import com.secura.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("SELECT m FROM Message m WHERE m.chatId = :chatId ORDER BY m.timestamp ASC")
    List<Message> findByChatIdOrderByTimestamp(@Param("chatId") String chatId);

    @Query("SELECT m FROM Message m WHERE m.recipientId = :recipientId AND m.id > :lastMessageId ORDER BY m.timestamp ASC")
    List<Message> findNewMessagesForRecipient(@Param("recipientId") String recipientId, @Param("lastMessageId") Long lastMessageId);

    @Query("SELECT m FROM Message m WHERE m.recipientId = :recipientId ORDER BY m.timestamp ASC")
    List<Message> findAllMessagesForRecipient(@Param("recipientId") String recipientId);

    @Query("SELECT m FROM Message m WHERE (m.senderId = :user1 AND m.recipientId = :user2) OR (m.senderId = :user2 AND m.recipientId = :user1) ORDER BY m.timestamp ASC")
    List<Message> findMessagesBetweenUsers(@Param("user1") String user1, @Param("user2") String user2);
}