package com.secura.repository;


import com.secura.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByRecipient(String recipient);

    @Query("SELECT m FROM Message m WHERE m.sender = :user OR m.recipient = :user ORDER BY m.timestamp ASC")
    List<Message> findAllMessagesForUser(@Param("user") String user);

}